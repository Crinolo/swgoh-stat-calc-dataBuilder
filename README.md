# swgoh-stat-calc-dataBuilder
 
Node package to build the 'gameData' object used by the [swgoh-stat-calc package](https://www.npmjs.com/package/swgoh-stat-calc), by pulling data from the [swgoh.help API](http://api.swgoh.help).

## Setup ##

### Installation ###
`npm install swgoh-stat-calc-dataBuilder`

### Initialization ###
```js
const dataBuilder = require('swgoh-stat-calc-dataBuilder')({
  username: <swgoh.help username>,
  password: <swgoh.help password>
});
let path = __dirname + '/../statCalcData/';
dataBuilder.loadData(path).then( ... );
```

Note that simply calling `require('swgoh-stat-calc-dataBuilder')` alone will return a function that initializes the dataBuilder, but does not return the dataBuilder object itself.\
The object passed to this initialization function is internally passed to a `new ApiSwgohHelp()` object that the dataBuilder will use.\
See the documentation for the [api-swgoh-help package](https://www.npmjs.com/package/api-swgoh-help) for more info on that, though the 'username' and 'password' properties should be all that's needed.

## Methods ##

* .loadData(path)
* .getData()
* .getVersion()
* .isUpdated()

### async .loadData(path) ###

Attempts to query swogh.help to collect the data needed and build the 'gameData' object.  Will save 'gameData.json' and 'dataVersion.json' files to the given folder.

#### Parameters ####

`path`*String*\
The path to the folder where the .json files should be saved.
Will also use that path to check for and cache temp files in case not all data can be aquired in one go.

#### Return Value ####

`true` if data was loaded successfully (either current data already found, or fresh data acquired).\
`false` if data failed to load the newest.  Stale data may have been loaded in its place in case needed.

### .getData() ###

Returns the currently loaded 'gameData' object.

#### Parameters ####

None.

#### Return Value ####

The currently loaded 'gameData' object.
Before `.loadData()` is called, this is an empty object.
Afterwards, it may contain partial data if `.loadData()` is still running, and stale data if `.loadData()` failed.
Use `.isUpdated()` to check the current update status.

### .getVersion() ###

Returns the current version object.
Will match the format used by swgoh.help's version endpoint here: [https://api.swgoh.help/version](https://api.swgoh.help/version)
Can be compared with their object to determine if data is fully updated.

#### Parameters ####

None.

#### Return Value ####

The current version object.
Before `.loadData()` is called, this is `undefined`.
It's updated to the current version of [swgoh.help's API](https://api.swgoh.help/version) when `.loadData()` starts.
If `.loadData()` fails and stale data is loaded, it should revert to the stale version info as well.

### .isUpdated() ###

Returns the current update status.

#### Parameters ####

None.

#### Return Value ####

`undefined` if `.loadData()` has not yet been called.\
`true` if `.loadData()` successfully updated.\
`false` if `.loadData()` is in progress, or has failed.

## Examples ##

Assuming this is being used in conjunction with the [swgoh-stat-calc](https://www.npmjs.com/package/swgoh-stat-calc) package:

```js
const statCalculator = require('swgoh-stat-calc');
const dataBuilder = require('swgoh-stat-calc-dataBuilder')({
  username: process.env.SWGOH_HELP_UNAME,
  password: process.env.SWGOH_HELP_PASS
});

await databuilder.loadData(__dirname + '/../statCalcData/');
statCalculator.setGameData( dataBuilder.getData() );
```
