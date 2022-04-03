const pdfjs = require("pdfjs-dist/build/pdf.js");
const PdfjsWorker = require("worker-loader?esModule=false&filename=[name].[contenthash].js!pdfjs-dist/build/pdf.worker.js");

if (typeof window !== "undefined" && "Worker" in window) {
  pdfjs.GlobalWorkerOptions.workerPort = new PdfjsWorker();
}

module.exports = pdfjs;
