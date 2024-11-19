# Geotab Challenge for Carlos Canet
This repository contains the solution developed by Carlos Canet for the Geotab Full Stack Developer challenge. The solution leverages the Geotab SDK and implements several optimizations to meet the challenge requirements.

## Key Features
- **Automatic Backup Folder Creation**: A folder is created to store backup files when needed.
- **Version Tracking**: 
  - You can specify the starting version for GPS or status data backups. If no version is provided as a parameter, the application will process events sequentially without skipping any. If no version is specified, the backup will start from the events of the last configurable number of hours.
  - Manually provided parameters override version information from the configuration file.
- **Efficient Data Processing**: 
  - All vehicles/devices from the database are preloaded into a map for improved performance.
  - The data processing loop handles API calls, result parsing, and file writing efficiently.
- **Unified API Calls**: The program consolidates API requests for both GPS and status data into a single operation to improve efficiency.
- **Ordered Event Storage**: All records (GPS and status) are processed, merged, and sorted by timestamp before being written to files.

## How to run

To execute the application, use the following command:
```
> node challengeGeotab_byCC.js --s server --d database --u user --p password --gt nnn --st nnn --f file path --c
```
### Command Line Arguments
```
--s  The Server
--d  The Database
--u  The User
--p  The Password
--gt [optional] The last known gps data version
--st [optional] The last known status data version
--f  [optional] The folder to save any output files to, if applicable. Defaults to the current directory.
--c  [optional] Run the feed continuously. Defaults to false.
```

### Example usage:
```
> node challengeGeotab_byCC.js --s "my.geotab.com" --d "database" --u "user@email.com" --p "password" --gt 0000000000000000 --st 0000000000000000 --f Backup_Files
```

## CSV Output
For each vehicle/device in the database, the program generates a dedicated CSV file. Fields without applicable values are represented by a `-` (e.g., odometer value in GPS records or GPS data in status records).
| # | Field name | Description | Example |
|---|---|---|---|
| 1 | Timestamp | The date and time in UTC of the event (GPS postion or odometer reading) | 2024-11-18T22:04:00.000Z |
| 2 | Event id | The identification value for the event | b108D4A |
| 3 | Vehicle Identification Number (VIN) | The unique vehicle identification number | 1HTMSTAR0KH0000001 |
| 4 | Latitude | The coordinate latitude in decimal degrees. | 43.7611504 |
| 5 | Longitude | The coordinate longitude in decimal degrees. | -79.4690323 |
| 6 | Vehicle Speed | The speed in km/h. | 51 |
| 7 | Odometer value | The value of the odometer in m. | 92271900 |
