const fs = require("fs").promises;
const path = require("path");

// Class representing a vehicle with ID, name, VIN and data backup functions
class Vehicle {
    constructor(vehicleId, name, vin, backupFolder) {
        this.vehicleId = vehicleId;
        this.name = name;
        this.vin = vin;
        this.backupFolder = backupFolder;
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

exports.Vehicle = Vehicle;