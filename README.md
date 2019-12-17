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

### .loadData(path) ###

Attempts to query swogh.help to collect the data needed and build the 'gameData' object.  Will save 'gameData.json' and 'dataVersion.json' files to the given folder.

#### Parameters ####

`path`*String*\
The path to the folder where the .json files should be saved.
Will also use that path to check for and cache temp files in case not all data can be aquired in one go.

#### Return Value ####

`true` if data was loaded successfully (either current data already found, or fresh data acquired).\
`false` if data failed to load the newest.  Stale data may have been loaded in its place in case needed.

