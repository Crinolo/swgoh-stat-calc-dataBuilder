// node runDataBuilder.js <swgoh.help Username> <swgoh.help Password>
const [node,script,uName,pass] = process.argv;

const fs = require('fs');

// local path to data builder used here, as this doesn't require itself to be installed.
// normally, use the line commented below instead.
const dataBuilder = require(__dirname + '/dataBuilder.js')({
/* const dataBuilder = require('swgoh-stat-calc-data-builder')({ */
  "username":uName,
  "password":pass
});
const path = __dirname + '/../statCalcData/';

dataBuilder.loadData(path).then( success => {
  if (success) {
    console.log(`Saved data to ${path}gameData.json\nVersion: ${JSON.stringify(dataBuilder.getVersion())}`);
    process.exit(0);
  } else {
    console.log('Continuing with outdated data');
    process.exit(1);
  }
});
