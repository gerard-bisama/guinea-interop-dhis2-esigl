const forever = require('forever-monitor');
const moment = require('moment')

  var child = new (forever.Monitor)('./lib/index.js', {
    append: true,
    max:5,
    silent: false,    
    logFile:"/home/exchange-server/forever_synchapi_openlmis.log",
    outFile: "/home/exchange-server/out_synchapi_openlmis.log",
    errFile: "/home/exchange-server/err_synchapi_openlmis.log",
    command: 'node --max_old_space_size=2000',
    args: []
  });

  child.on('restart', function () {
    console.log('index.js has been started on port 5022');
  });

  child.on('exit', function () {
    console.log('index.js has stoped');
  });

child.start();
