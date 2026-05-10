const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const uploadPath = "uploads";

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath);
}

// multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });

// memory store
let store = {};

// 🔐 ENCRYPT
function encrypt(buffer, password) {
    const key = crypto.scryptSync(password, "salt_key", 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

    const encrypted = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
    ]);

    return Buffer.concat([iv, encrypted]);
}

// 🔓 DECRYPT
function decrypt(buffer, password) {
    const iv = buffer.slice(0, 16);
    const data = buffer.slice(16);

    const key = crypto.scryptSync(password, "salt_key", 32);

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

    return Buffer.concat([
        decipher.update(data),
        decipher.final()
    ]);
}

// HOME
app.get("/", (req, res) => {
    res.send("GuardianBox Running 🔐");
});

// UPLOAD
app.post("/upload", upload.single("file"), (req, res) => {

    if (!req.file) {
        return res.json({ error: "No file uploaded" });
    }

    const password = req.body.password;
    const originalName = req.file.originalname;

    const fileData = fs.readFileSync(req.file.path);

    const encrypted = encrypt(fileData, password);

    const id = Date.now().toString();

    const filePath = `${uploadPath}/${id}.bin`;

    fs.writeFileSync(filePath, encrypted);

    fs.unlinkSync(req.file.path);

    store[id] = {
        name: originalName
    };

    res.json({
        id,
        filename: originalName
    });
});

// DECRYPT
app.post("/decrypt", (req, res) => {

    const { id, password } = req.body;

    const filePath = `${uploadPath}/${id}.bin`;

    if (!fs.existsSync(filePath)) {
        return res.json({ error: "File not found" });
    }

    try {

        const encrypted = fs.readFileSync(filePath);

        const decrypted = decrypt(encrypted, password);

        res.json({
            success: true,
            data: decrypted.toString("base64"),
            filename: store[id]?.name || "decrypted_file.bin"
        });

    } catch (err) {
        res.json({ error: "Wrong password or corrupted file" });
    }
});

app.listen(PORT, () => {
    console.log("Server running on http://localhost:" + PORT);
});