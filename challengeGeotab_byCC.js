const GeotabApi = require("mg-api-js");
const fs = require("fs").promises;
const path = require("path");

// Name of the file with the configuration parameters
const CONFIG_FILE = "config.json";

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
let lastLogVersion, lastStatusVersion;
let startDate = new Date(new Date() - HOURS_TO_BACKUP * 60 * 60 * 1000).toISOString();

// Directory where backup must be stored
const backupFolder = process.argv.indexOf("--f") >= 0 ? process.argv[process.argv.indexOf("--f") + 1] : "./";

// Class representing a vehicle with ID, name, VIN and data backup functions
class Vehicle {
  constructor(vehicleId, name, vin) {
    this.vehicleId = vehicleId;
    this.name = name;
    this.vin = vin;
    // Generate file path for this vehicle's data
    this.fileName = path.join(backupFolder, vehicleId + ".csv");
  }

  // Creates a new CSV file for this vehicle
  async createFile() {
    try {
      const exist = await fs.access(this.fileName, fs.constants.F_OK);
    } catch (error) {
      if (error.code === "ENOENT") {
        // Create the file if it doesn't exist
        await fs.writeFile(this.fileName, "timestamp,id,vin,lat,lon,speed,odometer\n");
      } else {
        console.log(`Error creating file for vehicle ${this.vehicleId}`);
      }
    }
  }

  // Appends the new data to this vehicle's CSV file
  async backupVehicle(data) {
    try {
      const lines = data
        .map((item) => {
          return `${item.timestamp.toISOString()},${item.id},${this.vin},${item.latitude},${item.longitude},${item.speed},${item.odometer}`;
        })
        .join("\n");
      // Create the CSV if it doesn't exist
      await this.createFile();
      await fs.appendFile(this.fileName, lines + "\n");
    } catch (error) {
      console.log(`Error writing file for vehicle ${this.vehicleId}: ${error.message}`);
    }
  }
}

// Creates a new CSV file for this vehicle
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

// Loads the last processed versions (of the feed) from configuration file
async function loadVersions() {
  try {
    lastLogVersion = process.argv.indexOf("--gt") >= 0 ? process.argv[process.argv.indexOf("--gt") + 1].toLowerCase() : undefined;
    lastStatusVersion = process.argv.indexOf("--st") >= 0 ? process.argv[process.argv.indexOf("--st") + 1].toLowerCase() : undefined;
    if (!lastLogVersion || !lastStatusVersion) {
      const config = await fs.readFile(CONFIG_FILE);
      const configJson = JSON.parse(config.toString());
      lastLogVersion = lastLogVersion ?? (configJson.lastLogVersion)?.toLowerCase();
      lastStatusVersion = lastStatusVersion ?? (configJson.lastStatusVersion)?.toLowerCase();
      // If versions are loaded, stop using starting date
    }
    if (lastLogVersion && lastStatusVersion) startDate = undefined;
  } catch (error) {
    if (error.code !== "ENOENT") console.log(`Bad JSON config file: ${error.message}`);
  }
}

// Update the last processed versions of the feed
async function updateVersions() {
  await fs.writeFile(CONFIG_FILE, JSON.stringify({ lastLogVersion, lastStatusVersion }));
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
        fleet.set(
          device.id,
          new Vehicle(
            device.id,
            device.name,
            device.vehicleIdentificationNumber
          )
        );
      }
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
}

// Processes fetched events, maps them, merge both maps in one structure and sorts them by timestamp grouped by vehicle ID
function processEvents(result) {
  const mappedLogEvents = result[0].data.map((logData) => {
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
  const mappedStatusEvents = result[1].data.map((statusData) => {
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

  return mappedEvents.reduce((prev, curr) => {
    prev[curr.deviceId] = prev[curr.deviceId] ? prev[curr.deviceId].concat(curr) : [curr];
    return prev;
  }, {});
}

// Fetches new data from the Geotab API feed, processes it, updates the versions and makes the backup per vehicle
async function run() {
  try {
    let calls = [];
    calls.push([
      "GetFeed",
      {
        typeName: "LogRecord",
        fromVersion: lastLogVersion,
        search: {
          fromDate: startDate,
        },
        // resultsLimit: 40000,
      },
    ]);

    calls.push([
      "GetFeed",
      {
        typeName: "StatusData",
        fromVersion: lastStatusVersion,
        search: {
          fromDate: startDate,
          diagnosticSearch: { id: "DiagnosticOdometerId" },
        },
        // resultsLimit: 40000,
      },
    ]);
    const result = await api.multiCall(calls);

    lastLogVersion = result[0].toVersion;
    lastStatusVersion = result[1].toVersion;
    startDate = undefined;
    await updateVersions();

    const groupedEvents = processEvents(result);
    Object.keys(groupedEvents).forEach((deviceId) => {
      fleet.get(deviceId).backupVehicle(groupedEvents[deviceId]);
    });

    console.log(
      `Backup done. ${result[0].data.length + result[1].data.length} events processed (${result[0].data.length} log events and ${result[1].data.length} status events).`
    );
  } catch (error) {
    console.error(error.message);
  }
}

// Initializes the script, loads versions, fetches vehicles data and starts the main loop
async function main() {
  await createFolder();
  await loadVersions();
  await getVehicles();
  await run();
  if (process.argv.indexOf("--c") >= 0)
    await setInterval(run, BACKUP_INTERVAL * 1000);
}

main();
