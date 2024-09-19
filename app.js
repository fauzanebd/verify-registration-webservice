const express = require("express");
const crypto = require("crypto");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const encryptionKey = crypto
  .createHash("sha256")
  .update(String(process.env.ENCRYPTION_KEY))
  .digest("base64")
  .slice(0, 32);

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(encryptionKey),
    iv
  );
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

function getSpreadsheetId(urlOrId) {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId;
}

const spreadsheetId = getSpreadsheetId(process.env.GOOGLE_SHEETS_ID);

async function checkRegistration(name, address, phoneNumber) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A:C",
    });

    const rows = response.data.values;
    if (rows) {
      return rows.some(
        (row) => row[0] === name && row[1] === address && row[2] === phoneNumber
      );
    }
    return false;
  } catch (error) {
    console.error("Error checking registration:", error);
    return false;
  }
}

app.get("/registration-verification/:id", async (req, res) => {
  try {
    const decrypted = decrypt(decodeURIComponent(req.params.id));
    const [name, address, phoneNumber] = decrypted.split("|");

    const isRegistered = await checkRegistration(name, address, phoneNumber);

    const htmlResponse = isRegistered
      ? `
            <html>
                <head>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            height: 100vh; 
                            margin: 0; 
                            background: linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%);
                        }
                        .container { 
                            text-align: center; 
                            padding: 20px; 
                            border-radius: 10px; 
                            background-color: rgba(255,255,255,0.8);
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>${name} telah terverifikasi sebagai peserta nobar Kelahiran Nabi Muhammad ﷺ</h1>
                    </div>
                </body>
            </html>
            `
      : `
            <html>
                <head>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            height: 100vh; 
                            margin: 0; 
                            background: linear-gradient(120deg, #ff9a9e 0%, #fecfef 100%);
                        }
                        .container { 
                            text-align: center; 
                            padding: 20px; 
                            border-radius: 10px; 
                            background-color: rgba(255,255,255,0.8);
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Peserta ${name} belum terverifikasi sebagai peserta nobar Kelahiran Nabi Muhammad ﷺ</h1>
                    </div>
                </body>
            </html>
            `;

    res.send(htmlResponse);
  } catch (error) {
    console.error("Error processing verification:", error);
    res.status(400).send("Invalid verification ID");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
