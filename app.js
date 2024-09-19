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

    const htmlResponse = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            margin: 0; 
            padding: 20px;
            box-sizing: border-box;
        }
        .gradient-bg {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: -1;
        }
        .container { 
            text-align: center; 
            padding: 20px; 
            border-radius: 10px; 
            background-color: rgba(255,255,255,0.8);
            max-width: 600px;
            width: 100%;
            margin: 0 20px;
        }
        h1 {
            font-size: 24px;
            line-height: 1.4;
        }
        @media (max-width: 600px) {
            h1 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="gradient-bg" id="gradientBg"></div>
    <div class="container">
        <h1 id="message"></h1>
    </div>
    <script>
        const isRegistered = ${isRegistered};
        const name = "${name.replace(/"/g, '\\"')}";

        document.getElementById('message').textContent = isRegistered
            ? name + " telah terverifikasi sebagai peserta nobar Kelahiran Nabi Muhammad ﷺ"
            : "Peserta " + name + " belum terverifikasi sebagai peserta nobar Kelahiran Nabi Muhammad ﷺ";

        document.getElementById('gradientBg').style.background = isRegistered
            ? 'linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)'
            : 'linear-gradient(120deg, #ff9a9e 0%, #fecfef 100%)';
    </script>
</body>
</html>
    `;

    res.send(htmlResponse);
  } catch (error) {
    console.error("Error processing verification:", error);
    res.status(400).send("Invalid verification ID");
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
