require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 4000;

const DEFAULT_CATEGORIES = [
  { name: 'Coding', colour: '#3b82f6' },
  { name: 'Writing', colour: '#10b981' },
  { name: 'Research', colour: '#8b5cf6' },
  { name: 'Creative', colour: '#ec4899' },
  { name: 'Data Analysis', colour: '#f59e0b' },
];

const PROMPT_TYPES = ['General', 'Coding', 'Writing', 'Research', 'Creative', 'Data'];

let firebaseReady = false;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(500, `${name} is not configured.`);
  }
  return value;
}

function initFirebase() {
  if (firebaseReady) {
    return;
  }

  const privateKey = requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: requireEnv('FIREBASE_PROJECT_ID'),
      client_email: requireEnv('FIREBASE_CLIENT_EMAIL'),
      private_key: privateKey,
    }),
  });

  firebaseReady = true;
}

function db() {
  initFirebase();
  return admin.firestore();
}

function auth() {
  initFirebase();
  return admin.auth();
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function isoDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'Login is required.');
  }

  return token;
}

function normaliseTags(tags) {
  const incoming = Array.isArray(tags)
    ? tags
    : String(tags || '')
        .split(',')
        .map((tag) => tag.trim());

  return [
    ...new Set(
      incoming
        .map((tag) => String(tag || '').trim().replace(/^#/, ''))
        .filter(Boolean)
    ),
  ];
}

function clampRating(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(parsed)));
}

function safePromptType(value) {
  const promptType = String(value || 'General').trim();
  return PROMPT_TYPES.includes(promptType) ? promptType : 'General';
}

function docData(snapshot) {
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    uid: row.id,
    displayName: row.displayName,
    email: row.email,
    role: row.role,
    isActive: row.isActive !== false,
    lastLoginAt: isoDate(row.lastLoginAt),
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
  };
}

function mapCategory(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    _id: row.id,
    name: row.name,
    colour: row.colour,
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
  };
}

function mapPrompt(row, category = null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    _id: row.id,
    title: row.title,
    body: row.body,
    promptType: row.promptType || 'General',
    categoryId: row.categoryId || null,
    category,
    tags: row.tags || [],
    rating: row.rating || 0,
    usageCount: row.usageCount || 0,
    createdAt: isoDate(row.createdAt),
    updatedAt: isoDate(row.updatedAt),
  };
}

function mapActivity(row, profile = null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId || null,
    summary: row.summary,
    metadata: row.metadata || {},
    createdAt: isoDate(row.createdAt),
    profile,
  };
}

function buildPromptPayload(body, ownerId) {
  const payload = {
    ownerId,
  };

  if ('title' in body) {
    payload.title = String(body.title || '').trim();
  }

  if ('body' in body) {
    payload.body = String(body.body || '').trim();
  }

  if ('promptType' in body) {
    payload.promptType = safePromptType(body.promptType);
  }

  if ('categoryId' in body || 'category' in body) {
    payload.categoryId = body.categoryId || body.category || null;
  }

  if ('tags' in body) {
    payload.tags = normaliseTags(body.tags);
  }

  if ('rating' in body) {
    payload.rating = clampRating(body.rating);
  }

  return payload;
}

async function seedDefaultCategories(userId) {
  const categories = await db()
    .collection('categories')
    .where('ownerId', '==', userId)
    .limit(1)
    .get();

  if (!categories.empty) {
    return;
  }

  const batch = db().batch();
  DEFAULT_CATEGORIES.forEach((category) => {
    const ref = db().collection('categories').doc();
    batch.set(ref, {
      ...category,
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

async function ensureUserProfile(decodedToken, displayName = '') {
  const userRef = db().collection('users').doc(decodedToken.uid);
  const existing = docData(await userRef.get());
  if (existing) {
    return {
      profile: existing,
      created: false,
    };
  }

  const authUser = await auth().getUser(decodedToken.uid);
  let created = false;

  await db().runTransaction(async (transaction) => {
    const existing = await transaction.get(userRef);

    if (existing.exists) {
      return;
    }

    const firstUserSnapshot = await transaction.get(db().collection('users').limit(1));
    const role = firstUserSnapshot.empty ? 'admin' : 'user';
    const now = serverTimestamp();
    const profileData = {
      displayName:
        String(displayName || authUser.displayName || '').trim() ||
        authUser.email?.split('@')[0] ||
        'Grimoire User',
      email: authUser.email || decodedToken.email || '',
      role,
      isActive: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };

    transaction.set(userRef, profileData);
    created = true;
  });

  if (created) {
    await seedDefaultCategories(decodedToken.uid);
  }

  return {
    profile: docData(await userRef.get()),
    created,
  };
}

async function logActivity(userId, action, entityType, entityId, summary, metadata = {}) {
  try {
    await db().collection('activities').add({
      userId,
      action,
      entityType,
      entityId: entityId || null,
      summary,
      metadata,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn(`Activity log skipped: ${error.message}`);
  }
}

async function authenticate(req, res, next) {
  try {
    const token = getBearerToken(req);

    // Firebase ID tokens are JWTs. The Admin SDK verifies the signature and issuer before routes run.
    const decodedToken = await auth().verifyIdToken(token);
    const { profile, created } = await ensureUserProfile(decodedToken);

    if (profile.isActive === false) {
      throw new HttpError(403, 'This account has been deactivated.');
    }

    req.authUser = decodedToken;
    req.profile = profile;
    req.profileWasCreated = created;
    next();
  } catch (error) {
    if (error.code?.startsWith('auth/')) {
      return next(new HttpError(401, 'Session is invalid or expired.'));
    }

    return next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.profile?.role !== 'admin') {
    return next(new HttpError(403, 'Admin access is required.'));
  }

  return next();
}

async function assertCategoryOwner(categoryId, ownerId) {
  if (!categoryId) {
    return;
  }

  const snapshot = await db().collection('categories').doc(categoryId).get();
  const category = docData(snapshot);

  if (!category || category.ownerId !== ownerId) {
    throw new HttpError(400, 'Selected category was not found.');
  }
}

async function getOwnerCategories(ownerId) {
  const snapshot = await db()
    .collection('categories')
    .where('ownerId', '==', ownerId)
    .get();

  const categories = snapshot.docs.map((doc) => mapCategory(docData(doc)));
  categories.sort((a, b) => a.name.localeCompare(b.name));
  return categories;
}

async function getPromptWithCategory(promptDoc, categoryMap = null) {
  const prompt = docData(promptDoc);
  if (!prompt) {
    return null;
  }

  let category = null;
  if (prompt.categoryId) {
    if (categoryMap) {
      category = categoryMap.get(prompt.categoryId) || null;
    } else {
      const categoryDoc = await db().collection('categories').doc(prompt.categoryId).get();
      category = mapCategory(docData(categoryDoc));
    }
  }

  return mapPrompt(prompt, category);
}

function filterAndSortPrompts(prompts, query) {
  const search = String(query.search || '').trim().toLowerCase();
  const promptType = String(query.promptType || '').trim();
  const categoryId = String(query.category || '').trim();

  const filtered = prompts.filter((prompt) => {
    const matchesSearch =
      !search ||
      [
        prompt.title,
        prompt.body,
        prompt.promptType,
        prompt.category?.name,
        ...(prompt.tags || []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(search);

    const matchesType = !promptType || prompt.promptType === promptType;
    const matchesCategory = !categoryId || prompt.categoryId === categoryId;

    return matchesSearch && matchesType && matchesCategory;
  });

  return filtered.sort((a, b) => {
    if (query.sort === 'rating') {
      return (b.rating || 0) - (a.rating || 0) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    }

    if (query.sort === 'usage') {
      return (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    }

    if (query.sort === 'oldest') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }

    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
}

async function getVaultData(ownerId, query = {}) {
  const [promptSnapshot, categories] = await Promise.all([
    db().collection('prompts').where('ownerId', '==', ownerId).get(),
    getOwnerCategories(ownerId),
  ]);

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const prompts = await Promise.all(
    promptSnapshot.docs.map((promptDoc) => getPromptWithCategory(promptDoc, categoryMap))
  );
  const totalCopies = prompts.reduce((sum, prompt) => sum + (prompt.usageCount || 0), 0);

  return {
    prompts: filterAndSortPrompts(prompts, query),
    categories,
    stats: {
      total: prompts.length,
      totalCategories: categories.length,
      totalCopies,
    },
  };
}

app.get('/api/health', (req, res) => {
  res.json({ data: { ok: true } });
});

app.post(
  '/api/auth/session',
  authenticate,
  asyncHandler(async (req, res) => {
    const displayName = String(req.body.displayName || '').trim();

    if (displayName && displayName !== req.profile.displayName) {
      await db().collection('users').doc(req.profile.id).update({
        displayName,
        updatedAt: serverTimestamp(),
      });
      req.profile.displayName = displayName;
    }

    await db().collection('users').doc(req.profile.id).update({
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (req.profileWasCreated) {
      await logActivity(req.profile.id, 'register', 'user', req.profile.id, 'Registered a new account', {
        role: req.profile.role,
      });
    }

    await logActivity(req.profile.id, 'login', 'user', req.profile.id, 'Logged in');
    res.json({ data: { profile: mapUser(req.profile) } });
  })
);

app.get(
  '/api/auth/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ data: { profile: mapUser(req.profile) } });
  })
);

app.get(
  '/api/vault',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ data: await getVaultData(req.profile.id, req.query) });
  })
);

app.post(
  '/api/auth/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await logActivity(req.profile.id, 'logout', 'user', req.profile.id, 'Logged out');
    res.json({ data: { ok: true } });
  })
);

app.get(
  '/api/prompts',
  authenticate,
  asyncHandler(async (req, res) => {
    const vault = await getVaultData(req.profile.id, req.query);
    res.json({ data: vault.prompts });
  })
);

app.post(
  '/api/prompts',
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = buildPromptPayload(req.body, req.profile.id);

    if (!payload.title || !payload.body) {
      throw new HttpError(400, 'Title and body are required.');
    }

    await assertCategoryOwner(payload.categoryId, req.profile.id);

    const promptRef = db().collection('prompts').doc();
    const promptData = {
      ...payload,
      usageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await promptRef.set(promptData);
    const prompt = await getPromptWithCategory(await promptRef.get());
    await logActivity(req.profile.id, 'create', 'prompt', promptRef.id, `Created spell "${payload.title}"`);

    res.status(201).json({ data: prompt });
  })
);

app.get(
  '/api/prompts/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const promptDoc = await db().collection('prompts').doc(req.params.id).get();
    const prompt = docData(promptDoc);

    if (!prompt || prompt.ownerId !== req.profile.id) {
      throw new HttpError(404, 'Prompt not found.');
    }

    res.json({ data: await getPromptWithCategory(promptDoc) });
  })
);

app.patch(
  '/api/prompts/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const promptRef = db().collection('prompts').doc(req.params.id);
    const promptDoc = await promptRef.get();
    const existing = docData(promptDoc);

    if (!existing || existing.ownerId !== req.profile.id) {
      throw new HttpError(404, 'Prompt not found.');
    }

    const payload = buildPromptPayload(req.body, req.profile.id);
    delete payload.ownerId;

    if ('categoryId' in payload) {
      await assertCategoryOwner(payload.categoryId, req.profile.id);
    }

    await promptRef.update({
      ...payload,
      updatedAt: serverTimestamp(),
    });

    const updated = await getPromptWithCategory(await promptRef.get());
    await logActivity(req.profile.id, 'update', 'prompt', promptRef.id, `Updated spell "${updated.title}"`);

    res.json({ data: updated });
  })
);

app.delete(
  '/api/prompts/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const promptRef = db().collection('prompts').doc(req.params.id);
    const promptDoc = await promptRef.get();
    const existing = docData(promptDoc);

    if (!existing || existing.ownerId !== req.profile.id) {
      throw new HttpError(404, 'Prompt not found.');
    }

    await promptRef.delete();
    await logActivity(req.profile.id, 'delete', 'prompt', promptRef.id, `Deleted spell "${existing.title}"`);

    res.json({ data: { deleted: true } });
  })
);

app.post(
  '/api/prompts/:id/copy',
  authenticate,
  asyncHandler(async (req, res) => {
    const promptRef = db().collection('prompts').doc(req.params.id);
    const result = await db().runTransaction(async (transaction) => {
      const promptDoc = await transaction.get(promptRef);
      const existing = docData(promptDoc);

      if (!existing || existing.ownerId !== req.profile.id) {
        throw new HttpError(404, 'Prompt not found.');
      }

      const usageCount = (existing.usageCount || 0) + 1;
      transaction.update(promptRef, {
        usageCount,
        updatedAt: serverTimestamp(),
      });

      return {
        title: existing.title,
        usageCount,
      };
    });

    await logActivity(req.profile.id, 'copy', 'prompt', promptRef.id, `Copied spell "${result.title}"`);
    res.json({ data: { ok: true, usageCount: result.usageCount } });
  })
);

app.get(
  '/api/categories',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ data: await getOwnerCategories(req.profile.id) });
  })
);

app.post(
  '/api/categories',
  authenticate,
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const colour = String(req.body.colour || '#7c3aed').trim();

    if (!name) {
      throw new HttpError(400, 'Category name is required.');
    }

    const duplicate = await db()
      .collection('categories')
      .where('ownerId', '==', req.profile.id)
      .where('name', '==', name)
      .limit(1)
      .get();

    if (!duplicate.empty) {
      throw new HttpError(400, 'That category already exists.');
    }

    const categoryRef = db().collection('categories').doc();
    await categoryRef.set({
      ownerId: req.profile.id,
      name,
      colour,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const category = mapCategory(docData(await categoryRef.get()));
    await logActivity(req.profile.id, 'create', 'category', categoryRef.id, `Created category "${name}"`);

    res.status(201).json({ data: category });
  })
);

app.patch(
  '/api/categories/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const categoryRef = db().collection('categories').doc(req.params.id);
    const categoryDoc = await categoryRef.get();
    const existing = docData(categoryDoc);

    if (!existing || existing.ownerId !== req.profile.id) {
      throw new HttpError(404, 'Category not found.');
    }

    const payload = {};
    if (req.body.name) {
      payload.name = String(req.body.name).trim();
    }
    if (req.body.colour) {
      payload.colour = String(req.body.colour).trim();
    }

    await categoryRef.update({
      ...payload,
      updatedAt: serverTimestamp(),
    });

    const updated = mapCategory(docData(await categoryRef.get()));
    await logActivity(req.profile.id, 'update', 'category', categoryRef.id, `Updated category "${updated.name}"`);

    res.json({ data: updated });
  })
);

app.delete(
  '/api/categories/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const categoryRef = db().collection('categories').doc(req.params.id);
    const categoryDoc = await categoryRef.get();
    const existing = docData(categoryDoc);

    if (!existing || existing.ownerId !== req.profile.id) {
      throw new HttpError(404, 'Category not found.');
    }

    const promptSnapshot = await db()
      .collection('prompts')
      .where('ownerId', '==', req.profile.id)
      .where('categoryId', '==', categoryRef.id)
      .get();

    const batch = db().batch();
    promptSnapshot.docs.forEach((promptDoc) => {
      batch.update(promptDoc.ref, {
        categoryId: null,
        updatedAt: serverTimestamp(),
      });
    });
    batch.delete(categoryRef);
    await batch.commit();

    await logActivity(req.profile.id, 'delete', 'category', categoryRef.id, `Deleted category "${existing.name}"`);
    res.json({ data: { deleted: true } });
  })
);

app.get(
  '/api/stats',
  authenticate,
  asyncHandler(async (req, res) => {
    const [promptSnapshot, categorySnapshot] = await Promise.all([
      db().collection('prompts').where('ownerId', '==', req.profile.id).get(),
      db().collection('categories').where('ownerId', '==', req.profile.id).get(),
    ]);

    const totalCopies = promptSnapshot.docs.reduce((sum, promptDoc) => {
      return sum + (promptDoc.data().usageCount || 0);
    }, 0);

    res.json({
      data: {
        total: promptSnapshot.size,
        totalCategories: categorySnapshot.size,
        totalCopies,
      },
    });
  })
);

app.get(
  '/api/users',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const snapshot = await db().collection('users').get();
    const users = snapshot.docs.map((userDoc) => mapUser(docData(userDoc)));
    users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json({ data: users });
  })
);

app.get(
  '/api/users/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = docData(await db().collection('users').doc(req.params.id).get());

    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    res.json({ data: mapUser(user) });
  })
);

app.patch(
  '/api/users/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userRef = db().collection('users').doc(req.params.id);
    const existing = docData(await userRef.get());

    if (!existing) {
      throw new HttpError(404, 'User not found.');
    }

    const payload = {};

    if (req.body.displayName) {
      payload.displayName = String(req.body.displayName).trim();
    }

    if (req.body.role) {
      const role = String(req.body.role);
      if (!['admin', 'user'].includes(role)) {
        throw new HttpError(400, 'Invalid role.');
      }
      if (req.params.id === req.profile.id && role !== req.profile.role) {
        throw new HttpError(400, 'You cannot change your own role.');
      }
      payload.role = role;
    }

    if ('isActive' in req.body) {
      if (req.params.id === req.profile.id && req.body.isActive === false) {
        throw new HttpError(400, 'You cannot deactivate your own account.');
      }
      payload.isActive = Boolean(req.body.isActive);
      await auth().updateUser(req.params.id, { disabled: !payload.isActive });
    }

    await userRef.update({
      ...payload,
      updatedAt: serverTimestamp(),
    });

    const updated = mapUser(docData(await userRef.get()));
    await logActivity(req.profile.id, 'update', 'user', updated.id, `Updated user "${updated.email}"`);

    res.json({ data: updated });
  })
);

app.delete(
  '/api/users/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (req.params.id === req.profile.id) {
      throw new HttpError(400, 'You cannot deactivate your own account.');
    }

    const userRef = db().collection('users').doc(req.params.id);
    const existing = docData(await userRef.get());

    if (!existing) {
      throw new HttpError(404, 'User not found.');
    }

    await Promise.all([
      userRef.update({
        isActive: false,
        updatedAt: serverTimestamp(),
      }),
      auth().updateUser(req.params.id, { disabled: true }),
    ]);

    await logActivity(req.profile.id, 'delete', 'user', req.params.id, `Deactivated user "${existing.email}"`);
    res.json({ data: { deleted: true } });
  })
);

app.get(
  '/api/activities',
  authenticate,
  asyncHandler(async (req, res) => {
    let snapshot;
    if (req.profile.role === 'admin') {
      snapshot = await db().collection('activities').get();
    } else {
      snapshot = await db().collection('activities').where('userId', '==', req.profile.id).get();
    }

    const userIds = [...new Set(snapshot.docs.map((activityDoc) => activityDoc.data().userId).filter(Boolean))];
    const userSnapshots = await Promise.all(
      userIds.map((userId) => db().collection('users').doc(userId).get())
    );
    const userMap = new Map(
      userSnapshots
        .map((userDoc) => mapUser(docData(userDoc)))
        .filter(Boolean)
        .map((user) => [user.id, user])
    );

    const activities = snapshot.docs.map((activityDoc) => {
      const activity = docData(activityDoc);
      return mapActivity(activity, userMap.get(activity.userId) || null);
    });
    activities.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({ data: activities.slice(0, 100) });
  })
);

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res.status(404).send('Run npm run dev for the React app, or npm run build before npm start.');
  });
}

app.use((error, req, res, next) => {
  console.error(error);

  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  if (error.code?.startsWith?.('auth/')) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(500).json({
    error: error.message || 'Something went wrong.',
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
