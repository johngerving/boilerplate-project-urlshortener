require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dns = require("node:dns");
const app = express();
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI);

// Schema for storing original and shortened URLs
let urlSchema = new mongoose.Schema({
  original_url: String,
  short_url: Number,
});

let URL = mongoose.model("URL", urlSchema);

const createURL = (original_url, done) => {
  // Get current number of URL documents
  URL.countDocuments({}).then((count) => {
    // Add a new URL to the collection with a short url of 1 more than the previous one
    let url = new URL({
      original_url: original_url,
      short_url: count + 1,
    });

    // Save document to db
    url
      .save()
      .then((doc) => {
        // Select original and short URL attributes from doc and return
        let data = {
          original_url: doc.original_url,
          short_url: doc.short_url,
        };
        done(null, data);
      })
      .catch((err) => {
        done(err, null);
      });
  });
};

const getURL = (short_url, done) => {
  // Get document by short_url
  URL.findOne({ short_url: short_url })
    .select({ original_url: 1 })
    .then((doc) => {
      // Return original URL
      done(null, doc.original_url);
    })
    .catch((err) => {
      done(err, null);
    });
};

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

app.post("/api/shorturl", function (req, res) {
  // Get URL submitted in req
  let original_url = req.body.url;

  // Check if provided URL begins with https:// or http://
  let httpRegex = /^https?:\/\//;
  if (!httpRegex.test(original_url)) {
    // If not valid, return invalid URL response
    return res.json({ err: "Invalid URL" });
  }

  // Retrieve only the domain name from the URL
  let justDomainRegex = /^https?:\/\/([^\/]+)\/?.*/;
  let justDomain = original_url.match(justDomainRegex)[1];
  // Lookup URL to see if it is valid
  dns.lookup(justDomain, (err, address, family) => {
    let isURLValid = err == null;

    if (!isURLValid) {
      res.json({ error: "Invalid URL" });
    } else {
      // Create document in db, send response
      createURL(original_url, function (err, data) {
        if (err) {
          res.json({ err: err });
        } else {
          res.json(data);
        }
      });
    }
  });
});

app.get("/api/shorturl/:short_url", function (req, res) {
  let short_url = req.params.short_url;

  getURL(short_url, function (err, data) {
    if (err) {
      return res.json({ err: err });
    }

    // Redirect to original URL
    let original_url = data;
    res.redirect(original_url);
  });
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
