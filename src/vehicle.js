const fs = require("fs").promises;
const path = require("path");
const readLastLines = require("read-last-lines");

// Class representing a vehicle with ID, name, VIN and data backup functions
class Vehicle {
  constructor(vehicleId, name, vin, backupFolder) {
    this.vehicleId = vehicleId;
    this.name = name;
    this.vin = vin;
    this.backupFolder = backupFolder;
    this.lastDate = new Date(0);
    // Generate file path for this vehicle's data
    this.fileName = path.join(backupFolder, vehicleId + ".csv");
  }

  // Creates a new CSV file for this vehicle
  async createFile() {
    try {
      const exist = await fs.access(this.fileName, fs.constants.F_OK);
      return false;
    } catch (error) {
      if (error.code === "ENOENT") {
        // Create the file if it doesn't exist
        await fs.writeFile(this.fileName, "timestamp,id,vin,lat,lon,speed,odometer\n");
        return true;
      } else {
        console.log(`Error creating file for vehicle ${this.vehicleId}`);
        throw error;
      }
    }
  }

  async loadLastDate() {
    const lastLine = await readLastLines.read(this.fileName, 1);
    const dateString = lastLine.split(",")[0];
    if (dateString == "") return;
    const date = new Date(dateString);
    if (!isNaN(date)) this.lastDate = date;
  }

  // Appends the new data to this vehicle's CSV file
  async backupVehicle(data) {
    try {
      // Create the CSV if it doesn't exist
      if (!(await this.createFile())) {
        await this.loadLastDate();
      }
      let lines = data
        .filter((item) => item.timestamp > this.lastDate)
        .map((item) => {
          return `${item.timestamp.toISOString()},${item.id},${this.vin},${item.latitude},${item.longitude},${item.speed},${item.odometer}`;
        });
        lines = lines.join("\n");
      await fs.appendFile(this.fileName, lines + "\n");
    } catch (error) {
      console.log(
        `Error writing file for vehicle ${this.vehicleId}: ${error.message}`
      );
    }
  }
}

exports.Vehicle = Vehicle;
