var fs = require("fs");

function readFileUtil(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, { encoding: "utf8", flag: "r" }, (err, data) => {
      if (err) {
        reject("Error " + err);
      } else {
        resolve(data.toString());
      }
    });
  });
}

function writeFileUtil(file, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(
      file,
      JSON.stringify(data),
      { encoding: "utf8", flag: "w" },
      (err) => {
        if (err) {
          reject("Error " + err);
        } else {
          resolve();
        }
      }
    );
  });
}

module.exports = { readFileUtil, writeFileUtil };
