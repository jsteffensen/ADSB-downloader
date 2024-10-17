const fs = require('fs');
const fsPromises = fs.promises;
const fsp = require('fs').promises;
const https = require('https');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const dataFile = './data.json';

let compiledData = {};
let idCount = 0;


(async () => {
  
  for(let i=0; i<10; i++) {
	  let file = '' + i + '.json';
	  await loadFile(file);
  }


})();

// Read .json files
const loadFile = (file) => {
  return new Promise((resolve, reject) => {

	const inputFile = path.join(dataDir, file);
	
    // Read the entire file content as a string
    fs.readFile(inputFile, 'utf8', (err, data) => {
      if (err) {
        console.error(`Error reading file ${inputFile}:`, err);
        return reject(err);
      }

      try {
        // Parse the file content as JSON
        const filteredData = parseJsonAndFilter(data);
		
      } catch (error) {
        console.error(`Error processing JSON in file ${inputFile}:`, error);
        reject(error);
      }
    });
  });
};

function parseJsonAndFilter(jsonString) {
    try {
        const jsonData = JSON.parse(jsonString);
		const returnData = [];
		
        // Check if the 'aircraft' key exists and return it
        if (jsonData.hasOwnProperty('aircraft')) {
			for(let i=0; i<jsonData['aircraft'].length; i++) {
				
				const isWithinLat1 = jsonData['aircraft'][i]['lat'] <= upperLeftLat;
				const isWithinLon1 = jsonData['aircraft'][i]['lon'] >= upperLeftLon;
				const isWithinLat2 = jsonData['aircraft'][i]['lat'] >= lowerRightLat;
				const isWithinLon2 = jsonData['aircraft'][i]['lon'] <= lowerRightLon;
				
				const isWithinLatLon = isWithinLat1 && isWithinLon1 && isWithinLat2 && isWithinLon2;
				
				if(isWithinLatLon) {
					//console.log(jsonData['aircraft'][i]);
					jsonData['aircraft'][i]['now'] = Math.round(jsonData['now']); 
					returnData.push(jsonData['aircraft'][i]);
				}
			}
            return returnData;
        } else {
            throw new Error("Key 'aircraft' not found in JSON data.");
        }
    } catch (error) {
        console.error("Error parsing JSON data: ", error);
        return null;
    }
}

const createDataFile = () => {
  return new Promise((resolve, reject) => {
	fs.closeSync(fs.openSync(dataFile, 'w'));
	resolve();
  });
};

const writeDataFile = () => {
  return new Promise((resolve, reject) => {
	  
		for(let i=0; i<datapoints.length; i++) {
			
			let hexValue = datapoints[i]['hex'];
			
			if(!compiledData.hasOwnProperty(hexValue)) {
				compiledData[hexValue] = JSON.parse(JSON.stringify(datapoints[i]));
				delete compiledData[hexValue]['now'];
				delete compiledData[hexValue]['nic'];
				delete compiledData[hexValue]['rc'];
				delete compiledData[hexValue]['alt_baro'];
				delete compiledData[hexValue]['gs'];
				delete compiledData[hexValue]['true_heading'];
				delete compiledData[hexValue]['squawk'];
				delete compiledData[hexValue]['emergency'];
				delete compiledData[hexValue]['alt_geom'];
				delete compiledData[hexValue]['track'];
				delete compiledData[hexValue]['baro_rate'];
				delete compiledData[hexValue]['nav_qnh'];
				delete compiledData[hexValue]['nav_altitude_mcp'];
				delete compiledData[hexValue]['nav_altitude_fms'];
				delete compiledData[hexValue]['nav_modes'];
				delete compiledData[hexValue]['lat'];
				delete compiledData[hexValue]['lon'];
				delete compiledData[hexValue]['seen_pos'];
				delete compiledData[hexValue]['version'];
				delete compiledData[hexValue]['nic_baro'];
				delete compiledData[hexValue]['nac_p'];
				delete compiledData[hexValue]['nac_v'];
				delete compiledData[hexValue]['sil'];
				delete compiledData[hexValue]['sil_type'];
				delete compiledData[hexValue]['gva'];
				delete compiledData[hexValue]['sda'];
				delete compiledData[hexValue]['alert'];
				delete compiledData[hexValue]['spi'];
				delete compiledData[hexValue]['mlat'];
				delete compiledData[hexValue]['tisb'];
				delete compiledData[hexValue]['messages'];
				delete compiledData[hexValue]['seen'];
				delete compiledData[hexValue]['rssi'];
				
				delete compiledData[hexValue]['ias'];
				delete compiledData[hexValue]['tas'];
				delete compiledData[hexValue]['mach'];
				delete compiledData[hexValue]['wd'];
				delete compiledData[hexValue]['ws'];
				delete compiledData[hexValue]['oat'];
				delete compiledData[hexValue]['tat'];
				delete compiledData[hexValue]['track_rate'];
				delete compiledData[hexValue]['roll'];
				delete compiledData[hexValue]['mag_heading'];
				delete compiledData[hexValue]['geom_rate'];
					
				compiledData[hexValue]['datapoints'] = [];
				idCount++;
			}
			
			let dataPoint = JSON.parse(JSON.stringify(datapoints[i]));

			delete dataPoint['hex'];
			delete dataPoint['type'];
			delete dataPoint['flight'];
			delete dataPoint['r'];
			delete dataPoint['t'];
			delete dataPoint['category'];
			delete dataPoint['nic'];
			delete dataPoint['rc'];
			delete dataPoint['nav_qnh'];
			delete dataPoint['nav_altitude_mcp'];
			delete dataPoint['nav_altitude_fms'];
			delete dataPoint['nav_modes'];
			delete dataPoint['seen_pos'];
			delete dataPoint['version'];
			delete dataPoint['nic_baro'];
			delete dataPoint['nac_p'];
			delete dataPoint['nac_v'];
			delete dataPoint['sil'];
			delete dataPoint['sil_type'];
			delete dataPoint['gva'];
			delete dataPoint['sda'];
			delete dataPoint['alert'];
			delete dataPoint['spi'];
			delete dataPoint['mlat'];
			delete dataPoint['tisb'];
			delete dataPoint['messages'];
			delete dataPoint['seen'];
			delete dataPoint['rssi'];

			compiledData[hexValue]['datapoints'].push(dataPoint);
		}

		fs.appendFile(dataFile, JSON.stringify(compiledData, null, 2), (err) => {
			if (err) {
				console.error(`Error writing to ${dataFile}:`, err);
				return reject(err);
			}
			console.log('Filtered data written. ' + idCount + ' IDs.');
			resolve();
		});
  });
};

