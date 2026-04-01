import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("travel_app.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER,
    data TEXT NOT NULL,
    lat REAL,
    lng REAL,
    ai_insights TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
  );
  
  INSERT OR IGNORE INTO folders (name) VALUES ('General');
`);

// Migration: Add ai_insights column if it doesn't exist
try {
  db.exec("ALTER TABLE photos ADD COLUMN ai_insights TEXT");
} catch (e) {
  // Column already exists or other error
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/folders", (req, res) => {
    const folders = db.prepare("SELECT * FROM folders").all();
    res.json(folders);
  });

  app.post("/api/folders", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO folders (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (e) {
      res.status(400).json({ error: "Folder already exists" });
    }
  });

  app.delete("/api/folders/:id", (req, res) => {
    db.prepare("DELETE FROM folders WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/photos", (req, res) => {
    const { folderId } = req.query;
    console.log("Fetching photos for folderId:", folderId);
    let photos;
    if (folderId && folderId !== 'undefined' && folderId !== 'null') {
      photos = db.prepare("SELECT * FROM photos WHERE folder_id = ? ORDER BY timestamp DESC").all(folderId);
    } else {
      photos = db.prepare("SELECT * FROM photos ORDER BY timestamp DESC").all();
    }
    res.json(photos);
  });

  app.post("/api/photos", (req, res) => {
    const { folderId, data, lat, lng, ai_insights } = req.body;
    console.log("Saving photo to folderId:", folderId);
    try {
      const info = db.prepare("INSERT INTO photos (folder_id, data, lat, lng, ai_insights) VALUES (?, ?, ?, ?, ?)").run(folderId, data, lat, lng, ai_insights);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error("Error saving photo:", error);
      res.status(500).json({ error: "Failed to save photo" });
    }
  });

  app.delete("/api/photos/:id", (req, res) => {
    db.prepare("DELETE FROM photos WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/photos/:id/folder", (req, res) => {
    const { folderId } = req.body;
    db.prepare("UPDATE photos SET folder_id = ? WHERE id = ?").run(folderId, req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/photos/:id/insights", (req, res) => {
    const { ai_insights } = req.body;
    db.prepare("UPDATE photos SET ai_insights = ? WHERE id = ?").run(ai_insights, req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
