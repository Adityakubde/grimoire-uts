require('dotenv').config();

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const Category = require('./models/Category');
const Prompt = require('./models/Prompt');

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_CATEGORIES = [
  { name: 'Coding', colour: '#3b82f6', icon: 'code' },
  { name: 'Writing', colour: '#10b981', icon: 'edit' },
  { name: 'Research', colour: '#8b5cf6', icon: 'search' },
  { name: 'Creative', colour: '#ec4899', icon: 'palette' },
  { name: 'Data Analysis', colour: '#f59e0b', icon: 'analytics' },
];

let connectionPromise = null;
let categoriesSeeded = false;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function normaliseTags(tags) {
  const incoming = Array.isArray(tags)
    ? tags
    : String(tags || '')
        .split(',')
        .map((tag) => tag.trim());

  return [...new Set(
    incoming
      .map((tag) => String(tag || '').trim().replace(/^#/, ''))
      .filter(Boolean)
  )];
}

function clampRating(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(parsed)));
}

function buildPromptPayload(body) {
  const payload = {};

  if ('title' in body) {
    payload.title = String(body.title || '').trim();
  }

  if ('body' in body) {
    payload.body = String(body.body || '').trim();
  }

  if ('model' in body) {
    payload.model = String(body.model || 'GPT-4o').trim() || 'GPT-4o';
  }

  if ('category' in body) {
    payload.category = body.category || null;
  }

  if ('tags' in body) {
    payload.tags = normaliseTags(body.tags);
  }

  if ('rating' in body) {
    payload.rating = clampRating(body.rating);
  }

  if ('isFavourite' in body) {
    payload.isFavourite = Boolean(body.isFavourite);
  }

  if ('isArchived' in body) {
    payload.isArchived = Boolean(body.isArchived);
  }

  return payload;
}

async function seedCategories() {
  if (categoriesSeeded) {
    return;
  }

  const count = await Category.countDocuments();
  if (count === 0) {
    await Category.insertMany(DEFAULT_CATEGORIES);
  }

  categoriesSeeded = true;
}

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and add your MongoDB Atlas connection string.');
  }

  if (mongoose.connection.readyState === 1) {
    await seedCategories();
    return mongoose.connection;
  }

  if (!connectionPromise) {
    // Keep a shared connection promise so local dev and Vercel requests do not race each other.
    connectionPromise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 5000 })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
  await seedCategories();
  return mongoose.connection;
}

function buildPromptQuery(queryString) {
  const query = {
    isArchived: queryString.archived === 'true',
  };

  if (queryString.model) {
    query.model = queryString.model;
  }

  if (queryString.category) {
    query.category = queryString.category;
  }

  if (queryString.search) {
    const searchRegex = new RegExp(queryString.search, 'i');
    query.$or = [
      { title: searchRegex },
      { body: searchRegex },
      { tags: searchRegex },
    ];
  }

  return query;
}

function buildPromptSort(sort) {
  if (sort === 'rating') {
    return { rating: -1, updatedAt: -1 };
  }

  if (sort === 'usage') {
    return { usageCount: -1, updatedAt: -1 };
  }

  if (sort === 'oldest') {
    return { createdAt: 1 };
  }

  return { updatedAt: -1 };
}

app.use('/api', async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/api/prompts', async (req, res, next) => {
  try {
    const prompts = await Prompt.find(buildPromptQuery(req.query))
      .sort(buildPromptSort(req.query.sort))
      .populate('category');

    res.json({ data: prompts });
  } catch (error) {
    next(error);
  }
});

app.post('/api/prompts', async (req, res, next) => {
  try {
    const prompt = await Prompt.create(buildPromptPayload(req.body));
    const populatedPrompt = await prompt.populate('category');

    res.status(201).json({ data: populatedPrompt });
  } catch (error) {
    next(error);
  }
});

app.get('/api/prompts/:id', async (req, res, next) => {
  try {
    const prompt = await Prompt.findById(req.params.id).populate('category');

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found.' });
    }

    res.json({ data: prompt });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/prompts/:id', async (req, res, next) => {
  try {
    const prompt = await Prompt.findByIdAndUpdate(
      req.params.id,
      buildPromptPayload(req.body),
      { new: true, runValidators: true }
    ).populate('category');

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found.' });
    }

    res.json({ data: prompt });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/prompts/:id', async (req, res, next) => {
  try {
    const prompt = await Prompt.findByIdAndDelete(req.params.id);

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found.' });
    }

    res.json({ data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/prompts/:id/copy', async (req, res, next) => {
  try {
    const prompt = await Prompt.findByIdAndUpdate(req.params.id, {
      $inc: { usageCount: 1 },
      lastUsedAt: new Date(),
    });

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found.' });
    }

    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/categories', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
});

app.post('/api/categories', async (req, res, next) => {
  try {
    const category = await Category.create({
      name: String(req.body.name || '').trim(),
      colour: String(req.body.colour || '#7c3aed').trim(),
      icon: String(req.body.icon || 'folder').trim(),
    });

    res.status(201).json({ data: category });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/categories/:id', async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.name ? { name: String(req.body.name).trim() } : {}),
        ...(req.body.colour ? { colour: String(req.body.colour).trim() } : {}),
        ...(req.body.icon ? { icon: String(req.body.icon).trim() } : {}),
      },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json({ data: category });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/categories/:id', async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    // Prompts keep working after a category is removed; they simply fall back to uncategorised.
    await Prompt.updateMany(
      { category: req.params.id },
      { $set: { category: null } }
    );

    res.json({ data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/stats', async (req, res, next) => {
  try {
    const [total, totalCategories, copies] = await Promise.all([
      Prompt.countDocuments({ isArchived: false }),
      Category.countDocuments(),
      Prompt.aggregate([
        { $group: { _id: null, sum: { $sum: '$usageCount' } } },
      ]),
    ]);

    res.json({
      data: {
        total,
        totalCategories,
        totalCopies: copies[0]?.sum ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid id format.' });
  }

  if (error.code === 11000) {
    return res.status(400).json({ error: 'That category already exists.' });
  }

  return res.status(500).json({
    error: error.message || 'Something went wrong.',
  });
});

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`Running on http://localhost:${PORT}`);

    try {
      await connectToDatabase();
      console.log('MongoDB connected');
    } catch (error) {
      console.warn(`MongoDB not ready: ${error.message}`);
    }
  });
}

module.exports = app;
