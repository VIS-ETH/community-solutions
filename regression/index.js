const program = require("commander");
const fs = require("fs-extra");
const path = require("path");
const url = require("url");
const sendRequest = require("request-promise-native");
const diffDefault = require("jest-diff");
const R = require("ramda");

program
  .option(
    "--base-url <url>",
    "URL of server where Community Solutions is running",
    "http://localhost:8080/",
  )
  .option("--no-diff", "Don't show human readable diffs")
  .option("--first", "Stop after first error");
program.parse(process.argv);

function tryJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

async function replayRecordedRequest(recordingEntry) {
  const res = await sendRequest(
    url.resolve(program.baseUrl, recordingEntry.request.url),
    {
      har: recordingEntry.request,
      timeout: 10000,
      resolveWithFullResponse: true,
      simple: false,
    },
  );
  return {
    status: res.statusCode,
    body: tryJson(res.body),
  };
}

async function main() {
  const recordings = JSON.parse(
    await fs.readFile(path.join(__dirname, "recordings/1/fletchz.json")),
  );

  let failedSomething = false;
  for (const recordingEntry of recordings) {
    function printResult(passed) {
      console.log(
        [
          passed ? "PASS" : "FAIL",
          recordingEntry.request.method,
          url.parse(recordingEntry.request.url).path,
        ].join(" "),
      );
    }

    let failedEntry = false;
    try {
      const recordedRes = {
        status: recordingEntry.response.status,
        body: tryJson(recordingEntry.response.content.text),
      };
      const res = await replayRecordedRequest(recordingEntry);
      const isPdf = !!recordingEntry.response.headers.find(
        R.equals({ name: "content-type", value: "application/pdf" }),
      );
      const match = isPdf ? true : R.equals(recordedRes, res);
      failedEntry = failedEntry || !match;
      printResult(match);
      if (!match && program.diff) {
        console.log(diffDefault(recordedRes, res));
        console.log("\n");
      }
    } catch (err) {
      failedEntry = true;
      printResult(false);
      console.log(err);
      console.log("\n");
    }

    if (failedEntry) {
      failedSomething = true;
      if (program.first) {
        break;
      }
    }
  }

  if (failedSomething) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
