const authentication = {
    credentials: {
        database: 'demo_candidates_net',
        userName: 'carlos@carlosca.net',
        password: 'JFd3Bz_p4QgLCfYw67JYwxzGRUiYgC_P'
    },
    path: 'mypreview.geotab.com'
}

const GeotabApi = require('mg-api-js');
const api = new GeotabApi(authentication);
let startDate = new Date(new Date().setUTCHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000).toISOString();
let lastLogVersion, lastStatusVersion;

async function run() {
    let calls = [];
    calls.push(["GetFeed", {
        "typeName": "LogRecord",
        "fromVersion": lastLogVersion,
        "search": {
            "fromDate": startDate
        },
        "resultsLimit": 10000,
    }]);

    calls.push(["GetFeed", {
        "typeName": "StatusData",
        "fromVersion": lastStatusVersion,
        "search": {
            "fromDate": startDate,
            "diagnosticSearch": { id: "DiagnosticOdometerId" }
        },
        "resultsLimit": 10000,
    }]);
    const result = await api.multiCall(calls);
    lastLogVersion = result[0].toVersion;
    lastStatusVersion = result[1].toVersion;
    startDate = null;
    // console.log(JSON.stringify(result, null, 2));
    console.log(result[0].data.length, result[0].toVersion);
    console.log(result[1].data.length, result[1].toVersion, result[1].data[result[1].data.length - 1]?.dateTime);
    console.log(JSON.stringify(result[1].data, null, 2));
}

setInterval(run, 1000 * 10);