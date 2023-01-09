"use strict";
import fetch from "node-fetch";
import fs from "fs";
import { createServer } from "http";
import { ConsoleLogColors } from "js-console-log-colors";
const out = new ConsoleLogColors();

const config = {
  API_QUERY_URL:
    "https://lcd-osmosis.blockapsis.com/osmosis/pool-incentives/v1beta1/external_incentive_gauges",
  host: "localhost",
  port: 7000,
  cache_seconds: 3600,
};

const server = createServer(async (req, res) => {
  // whenever a request is received...
  out.info("##### Client Request: " + req.method + " " + req.url);

  // this is the final variable for response output
  let responseText = "";

  // we are using localhost, so request url isn't absolute, we need to just append it to a dummy domain for it to work
  const url = new URL(req.url, "http://example.test"); // leave this line as is
  if (req.method === "GET" || req.method === "POST") {
    // determine the type of action based on requested URL path
    const arrPath = url.pathname.split("/");

    res.setHeader("Content-Type", "text/html");
    // res.writeHead(200, {
    //   "Content-Type": "application/json",
    // });
    let externals = {};
    let searchResults = [];
    // determine action based on URL path...
    switch (arrPath[1]) {
      case "pool":
        if (!arrPath[2]) {
          let errorMsg = "expected pool ID";
          out.error(errorMsg);
          responseText = JSON.stringify({ error: errorMsg });
          break;
        }

        externals = await fetchExternals();
        searchResults = externals.data.filter(
          (external) =>
            external.distribute_to.denom === `gamm/pool/${arrPath[2]}`
        );
        res.writeHead(200, {
          // "Content-Type": "application/json",
          "Content-Type": "text/html",
        });
        responseText =
        "<html><body><style>*{background-color:black;color:#3d9954;}</style><pre>" + JSON.stringify({ data: searchResults }, null, 2) + "</pre></body></html>";
        //out.info(responseText);
        break;
      case "rewards":
        if (!arrPath[2] && !!arrPath[3]) {
          let errorMsg = "expected coins denom";
          out.error(errorMsg);
          responseText = JSON.stringify({ error: errorMsg });
          break;
        }

        externals = await fetchExternals();

        searchResults = externals.data.filter((external) =>
          external.coins.some(
            (coin) => coin.denom === `${arrPath[2]}/${arrPath[3]}`
          )
        );

        res.writeHead(200, {
          // "Content-Type": "application/json",
          "Content-Type": "text/html",
        });
        responseText =
          "<html><body><style>*{background-color:black;color:#3d9954;}</style><pre>" + JSON.stringify({ data: searchResults }, null, 2) + "</pre></body></html>";
        //out.info(responseText);
        break;
      default:
        responseText = `Please use one of the following:
            <br><br>
            <ul>
              <li>/pool/{id}
                <br>e.g:<br><a href="/pool/856">/pool/856</a>
              </li>
              <li>/rewards/{denom}
                <br>e.g:<br><a href="/rewards/ibc/C822645522FC3EECF817609AA38C24B64D04F5C267A23BCCF8F2E3BC5755FA88">/rewards/ibc/C822645522FC3EECF817609AA38C24B64D04F5C267A23BCCF8F2E3BC5755FA88</a>
              </li>
            </ul>`;
    }

    // everything is successful, send response (and close the connection)
    res.write(responseText);
    res.end();
    return;
  }
  // requested page not valid...
  res.writeHead(404);
  res.end();
});

// start the server process...
server.listen(
  config.port,
  /*config.host,*/ () => {
    out.success(`Server is running on http://${config.host}:${config.port}`);
  }
);

async function fetchExternals() {
  out.command("Checking local cache...");
  if (isCacheOutdated()) {
    out.info(
      "Cache is too old. Refreshing from API (this may take a moment)..."
    );
    var data = await fetch(`${config.API_QUERY_URL}`).then((res) => res.json());
    out.info("Data fetched from API!");
    out.command("Caching locally...");
    fs.writeFileSync("externals.json", JSON.stringify(data), (err) => {
      if (err) {
        out.error(err.message);
        return;
      }
    });
    out.success("Cache updated!");
  }

  try {
    let data = fs.readFileSync("externals.json");
    return JSON.parse(data);
  } catch (err) {
    out.error(err);
  }
}

function isCacheOutdated() {
  const stats = fs.statSync("externals.json");
  let ageInSeconds = (Date.now() - stats.mtime.getTime()) / 1000;
  return ageInSeconds > config.cache_seconds;
}
