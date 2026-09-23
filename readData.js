const fs = require("fs");
const path = require("path");

function readData() {
    const filePath = path.join(__dirname, "quizData.json");
    const data = fs.readFileSync(filePath, "utf8");

    return JSON.parse(data);
}

module.exports = readData;
