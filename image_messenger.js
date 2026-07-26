/**
 * image_messenger.js
 *
 * A tiny Express server that:
 *  1) Serves your service banner images (GET /images, GET /images/:id)
 *  2) Sends any of those images to an external URL/API via axios
 *     (POST /send) — either as multipart/form-data (real file upload,
 *     works with things like Slack/Discord/Telegram webhooks) or as
 *     base64 JSON (works with APIs that expect JSON payloads).
 *
 * SETUP
 *   npm init -y
 *   npm install express axios form-data
 *   node image_messenger.js
 *
 * Put your PNG files in an "images" folder next to this file.
 */

import express from "express";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const IMAGES_DIR = path.join(__dirname, "images/services_images");

// Registry of available images: id -> filename + label
const IMAGES = {
  "1": { file: "1_custom_web_applications.png", title: "Custom Web Applications" },
  "2": { file: "2_business_websites.png", title: "Business Websites" },
  "4": { file: "4_api_integration_automation.png", title: "API Integration & Automation" },
  "5": { file: "5_short_form_video_editing.png", title: "Short-Form Video Editing" },
  "6": { file: "6_maintenance_support.png", title: "Maintenance & Support" },
  "7": { file: "logo.png", title: "logo" },
};

// Serve the images folder directly, e.g. GET /images/1_custom_web_applications.png
app.use("/images", express.static(IMAGES_DIR));

// List available images with their metadata + direct URL
app.get("/images", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const list = Object.entries(IMAGES).map(([id, info]) => ({
    id,
    title: info.title,
    url: `${base}/images/${info.file}`,
  }));
  res.json(list);
});

/**
 * POST /send
 * Body:
 * {
 *   "id": "1",                         // which image (see /images for ids)
 *   "targetUrl": "https://...",        // where to send it
 *   "mode": "multipart" | "base64"     // how to send it (default: "multipart")
 * }
 *
 * multipart -> sends the raw file as form-data under field "image"
 *              (good for Slack/Discord/Telegram-style webhooks)
 * base64    -> sends { title, filename, imageBase64 } as JSON
 *              (good for custom APIs expecting JSON)
 */
app.post("/send", async (req, res) => {
  const { id, targetUrl, mode = "multipart" } = req.body;

  if (!id || !IMAGES[id]) {
    return res.status(400).json({ error: `Unknown image id "${id}". Try one of: ${Object.keys(IMAGES).join(", ")}` });
  }
  if (!targetUrl) {
    return res.status(400).json({ error: "targetUrl is required" });
  }

  const { file, title } = IMAGES[id];
  const filePath = path.join(IMAGES_DIR, file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `File not found on server: ${file}` });
  }

  try {
    let response;

    if (mode === "base64") {
      const imageBase64 = fs.readFileSync(filePath, { encoding: "base64" });
      response = await axios.post(targetUrl, {
        title,
        filename: file,
        imageBase64,
      });
    } else {
      const form = new FormData();
      form.append("image", fs.createReadStream(filePath), file);
      form.append("title", title);
      response = await axios.post(targetUrl, form, {
        headers: form.getHeaders(),
      });
    }

    res.json({
      success: true,
      sent: file,
      targetUrl,
      remoteStatus: response.status,
      remoteData: response.data,
    });
  } catch (err) {
    res.status(502).json({
      error: "Failed to send image to targetUrl",
      details: err.response?.data || err.message,
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "image_messenger is running",
    endpoints: {
      "GET /images": "list available images with direct URLs",
      "GET /images/:filename": "fetch a specific image file",
      "POST /send": "send an image to an external URL via axios (see source comments for body shape)",
    },
  });
});

app.listen(PORT, () => {
  console.log(`image_messenger listening on http://localhost:${PORT}`);
});