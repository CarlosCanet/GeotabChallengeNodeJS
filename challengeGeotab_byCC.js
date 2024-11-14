const GeotabApi = require('mg-api-js');
const fs = require('fs').promises;
const path = require('path');

const AUTHENTICATION = {
    credentials: {
        database: 'demo_candidates_net',
        userName: 'carlos@carlosca.net',
        password: 'JFd3Bz_p4QgLCfYw67JYwxzGRUiYgC_P'
    },
    path: 'mypreview.geotab.com'
}
const BACKUP_FOLDER = "backup_files";
const CONFIG_FILE = "config.json";

const api = new GeotabApi(AUTHENTICATION);
const fleet = new Map();
let lastLogVersion, lastStatusVersion;
let startDate = new Date(new Date().setUTCHours(0, 0, 0, 0) - 12 * 60 * 60 * 1000).toISOString();

class Vehicle {
    constructor(vehicleId, name, vin) {
        this.vehicleId = vehicleId;
        this.name = name;
        this.vin = vin;
        this.data = [];
        this.fileName = path.join(BACKUP_FOLDER, vehicleId + ".csv");
        this.createFile();
    }

    async createFile() {
        try {
            const exist = await fs.access(this.fileName, fs.constants.F_OK);
        } catch (error) {
            if (error.code === "ENOENT") {
                await fs.writeFile(this.fileName, "timestamp,id,vin,lat,lon,speed,odometer\n");
            } else {
                console.log(`Error creating file for vehicle ${this.vehicleId}`);
            }
        }
    }

    async backupVehicle(data) {
        try {
            const lines = data.map((item) => {
                return `${item.timestamp.toISOString()},${item.id},${this.vin},${item.latitude},${item.longitude},${item.speed},${item.odometer}`;
            }).join("\n");
            await fs.appendFile(this.fileName, lines + "\n");
        } catch (error) {
            console.log(`Error writing file for vehicle ${this.vehicleId}`);
        }
    }
}

async function loadVersions() {
    try {
        const config = await fs.readFile(CONFIG_FILE);
        const configJson = JSON.parse(config.toString());
        lastLogVersion = configJson.lastLogVersion;
        lastStatusVersion = configJson.lastStatusVersion;
        if (lastLogVersion && lastStatusVersion) startDate = undefined;
    } catch (error) {
        console.log(error.message);
    }
}

async function updateVersions() {
    await fs.writeFile(CONFIG_FILE, JSON.stringify({ lastLogVersion, lastStatusVersion }));
}

async function getVehicles() {
    try {
        const devices = await api.call("Get", {
            typeName: "Device",
            search: {
                "groups": [
                    {
                        "id": "GroupCompanyId"
                    }
                ]
            },
        });
        devices.forEach(device => {
            if (!fleet.has(device.id)) {
                fleet.set(device.id, new Vehicle(device.id, device.name, device.vehicleIdentificationNumber));
            }
        });
    } catch (error) {
        console.log(error.message);
        process.exit(1);
    }
}

function processEvents() {
    const mappedLogEvents = result[0].data.map(logData => {
        return { deviceId: logData.device.id, timestamp: new Date(logData.dateTime), id: logData.id, latitude: logData.latitude, longitude: logData.longitude, speed: logData.speed, odometer: "-" };
    });
    const mappedStatusEvents = result[1].data.map(statusData => {
        return { deviceId: statusData.device.id, timestamp: new Date(statusData.dateTime), id: statusData.id, latitude: "-", longitude: "-", speed: "-", odometer: statusData.data };
    });
    const mappedEvents = mappedLogEvents.concat(mappedStatusEvents).sort(function (a, b) {
        return a.timestamp - b.timestamp;
    });

    return mappedEvents.reduce((prev, curr) => {
        prev[curr.deviceId] = prev[curr.deviceId] ? prev[curr.deviceId].concat(curr) : [curr];
        return prev;
    }, {});
}

async function run() {
    let calls = [];
    calls.push(["GetFeed", {
        "typeName": "LogRecord",
        "fromVersion": lastLogVersion,
        "search": {
            "fromDate": startDate
        },
        // "resultsLimit": 40000,
    }]);

    calls.push(["GetFeed", {
        "typeName": "StatusData",
        "fromVersion": lastStatusVersion,
        "search": {
            "fromDate": startDate,
            "diagnosticSearch": { id: "DiagnosticOdometerId" }
        },
        // "resultsLimit": 40000,
    }]);
    const result = await api.multiCall(calls);

    lastLogVersion = result[0].toVersion;
    lastStatusVersion = result[1].toVersion;
    startDate = undefined;
    await updateVersions();

    const groupedEvents = processEvents();
    Object.keys(groupedEvents).forEach(deviceId => { fleet.get(deviceId).backupVehicle(groupedEvents[deviceId]) });

    console.log(JSON.stringify(result[0].data, null, 2));
    console.log(JSON.stringify(result[1].data, null, 2));
    console.log(result[0].data.length, result[0].toVersion);
    console.log(result[1].data.length, result[1].toVersion, result[1].data[result[1].data.length - 1]?.dateTime);
}

async function main() {
    await loadVersions();
    await getVehicles();
    await run();
    await setInterval(run, 1000 * 10);
}

main();