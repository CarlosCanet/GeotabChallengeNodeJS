const GeotabApi = require("mg-api-js");
const { Vehicle } = require("./vehicle");
const fs = require("fs").promises;

// Interval between readings from API (in seconds)
const BACKUP_INTERVAL = 20;

// Hours to backup if there is not backup files
const HOURS_TO_BACKUP = 12;

// Check correct arguments
if (
  process.argv.length < 10 ||
  process.argv.indexOf("--s") < 0 ||
  process.argv.indexOf("--d") < 0 ||
  process.argv.indexOf("--u") < 0 ||
  process.argv.indexOf("--p") < 0
) {
  console.error("Usage: ");
  console.error(`> node ${process.argv[1]} --s server --d database --u user --p password --gt Last GPS token --st Last Status token --f path`);
  return -1;
}

// Geotab API authentication credentials
const authentication = {
  credentials: {
    database: process.argv[process.argv.indexOf("--d") + 1],
    userName: process.argv[process.argv.indexOf("--u") + 1],
    password: process.argv[process.argv.indexOf("--p") + 1],
  },
  path: process.argv[process.argv.indexOf("--s") + 1],
};

// Create Geotab API client instance, map to store data, last processed version (if done) and starting date (if there is no previous backup)
const api = new GeotabApi(authentication); // If authentication is not valid it is checked in GeotabApi
const fleet = new Map();
let startDate = new Date(new Date() - HOURS_TO_BACKUP * 60 * 60 * 1000).toISOString();

// Directory where backup must be stored
const backupFolder = process.argv.indexOf("--f") >= 0 ? process.argv[process.argv.indexOf("--f") + 1] : "./";

// Creates the backup files folder
async function createFolder() {
  try {
    const exist = await fs.access(backupFolder, fs.constants.F_OK);
  } catch (error) {
    if (error.code === "ENOENT") {
      // Create the file if it doesn't exist
      await fs.mkdir(backupFolder);
    } else {
      console.log(`Error creating backup folder`);
    }
  }
}

// Fetch a list of vehicles from the Geotab API and create Vehicle objects (in a map)
async function getVehicles() {
  try {
    const devices = await api.call("Get", {
      typeName: "Device",
      search: {
        groups: [
          {
            id: "GroupCompanyId",
          },
        ],
      },
    });
    devices.forEach((device) => {
      if (!fleet.has(device.id)) {
        fleet.set(device.id, new Vehicle(device.id, device.name, device.vehicleIdentificationNumber, backupFolder));
      }
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

// Processes fetched events, maps them, merge both maps in one structure and sorts them by timestamp grouped by vehicle ID
async function processEvents(result) {
  const mappedLogEvents = result[0].map((logData) => {
    return {
      deviceId: logData.device.id,
      timestamp: new Date(logData.dateTime),
      id: logData.id,
      latitude: logData.latitude,
      longitude: logData.longitude,
      speed: logData.speed,
      odometer: "-",
    };
  });
  const mappedStatusEvents = result[1].map((statusData) => {
    return {
      deviceId: statusData.device.id,
      timestamp: new Date(statusData.dateTime),
      id: statusData.id,
      latitude: "-",
      longitude: "-",
      speed: "-",
      odometer: statusData.data,
    };
  });
  const mappedEvents = mappedLogEvents
    .concat(mappedStatusEvents)
    .sort(function (a, b) {
      return a.timestamp - b.timestamp;
    });

  const groupedEvents = mappedEvents.reduce((prev, curr) => {
    prev[curr.deviceId] = prev[curr.deviceId] ? prev[curr.deviceId].concat(curr) : [curr];
    return prev;
  }, {});

  const promises = Object.keys(groupedEvents).map((deviceId) => {
    return fleet.get(deviceId).backupVehicle(groupedEvents[deviceId]);
  });
  await Promise.all(promises);
}

// Fetches new data from the Geotab API feed, processes it, updates the versions and makes the backup per vehicle
async function run() {
  try {
    let calls = [];
    calls.push([
      "Get",
      {
        typeName: "LogRecord",
        search: {
          fromDate: startDate,
        },
        // resultsLimit: 40000,
      },
    ]);

    calls.push([
      "Get",
      {
        typeName: "StatusData",
        search: {
          fromDate: startDate,
          diagnosticSearch: { id: "DiagnosticOdometerId" },
        },
        // resultsLimit: 40000,
      },
    ]);
    const result = await api.multiCall(calls);
    startDate = new Date().toISOString();

    await processEvents(result);
    console.log(
      `Backup done. ${result[0].length + result[1].length} events processed (${result[0].length} log events and ${result[1].length} status events).`
    );
  } catch (error) {
    console.error(error.message);
  }
}

// Initializes the script, loads versions, fetches vehicles data and starts the main loop
async function main() {
  await createFolder();
  await getVehicles();
  await run();
  if (process.argv.indexOf("--c") >= 0)
    await setInterval(run, BACKUP_INTERVAL * 1000);
}

main();
