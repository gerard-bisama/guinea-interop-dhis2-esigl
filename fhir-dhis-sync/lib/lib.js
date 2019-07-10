const moment = require('moment');
const url=require('url');
const manifest = require('../config/manifest')
const uuidv1 = require('uuid/v1');
var csvUtil = require('csv-util');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/interopmediator');
var Schema=mongoose.Schema;


//Format the string date ISO8601 from DHIS2 in Zform (Zulu time Zone) whikch is the format accepted by HAPI Fhir Server
//The format looks like  yyyy-mm-ddThh:mm:ss+zz:zz ; the last part is the zone indicator
function formatDateInZform(originalDate)
{
	var formatedDate="";
	var dateComponants=[];
	//Check if at least it is timedate format
	var dateCorrected="";
	if(originalDate.includes("T")==false)
	{
		dateCorrected=originalDate.replace(" ","T");
		//console.log("date: "+originalDate);
	}
	else
	{
		dateCorrected=originalDate;
	}
	
	//console.log("Date :"+dateCorrected);
	if(dateCorrected.includes("+"))
	{
		var dateComponants=dateCorrected.split("+");
		if(dateComponants.length>0)
		{
			formatedDate=dateComponants[0];//+"+00:00"
			//formatedDate+="+00:00";
			if(formatedDate.includes("Z")||formatedDate.includes("z"))
			{
				var dateComponant2=formatedDate.split("Z");
				formatedDate=dateComponant2[0];
			}
		}
	}
	else
	{
		//add the timestamp part 
		//console.log(dateCorrected+"T00:00:00.000+01:00");
		formatedDate=dateCorrected+"T00:00:00.000";
	}
	
	return formatedDate+manifest.typeZone;
}
//read CSV file as specified
//@@ _filename: full path of the file name
exports.readCSVFile=function readCSVFile(_filename,callback)
{
	//var filename=path.resolve(path.join(manifest.source_directory, "/", _filename));
	var filename=_filename;
	var csvParser = csvUtil.csvParser;
	var csvData = csvParser(filename,function(row){
	  var newRow = row.map(function(value,index){
		return value;
	  })
	  return newRow
	}).then(function(csvData){
  		return callback(csvData);
	});
}

//---------------------------------Mongodb part to manage http load to push requisition to fhir server--------------------------
var organizationSchema=Schema({
	code: String,
	lastDateOfRequisitionSync:Date
});
var requisitionSyncSchema=Schema({
	code:String, //by default 1
	lastDateSynched:Date
});
var synchedOrganizationDefinition=mongoose.model('synchedOrganization',organizationSchema);
var synchedRequisitionDefinition=mongoose.model('synchedRequisition',requisitionSyncSchema);
//return the list of organization which requisition has been already synched
var getAllSynchedOrganization=function (callback)
{
	var requestResult=synchedOrganizationDefinition.find({}).exec(function(error,synchedOrganizationsList){
		if(error) return handleError(err);
		return callback(synchedOrganizationsList);
		});
}
var getLastSynchedRequisitionDate=function (callback)
{
	var requestResult=synchedOrganizationDefinition.findOne({"code":1}).exec(function(error,lastSynchedRequisitionDate){
		if(error) return handleError(err);
		return callback(lastSynchedRequisitionDate);
		});
}
var updateSynchedRequisitionDate=function (_lastSynchedDate,callback)
{
	synchedRequisitionDefinition.findOneAndUpdate({code:"1"},{$set:{lastDateSynched:_lastSynchedDate}},{upsert:true},(err, doc) => {
		if (err) {
			console.log("Error: Failed to update the record!");
		}
		console.log(true)
	}
	)
}
var upsertSynchedOrganization=function(synchedOrganization,callback)
{
	synchedOrganizationDefinition.findOne({
			code:synchedOrganization.code,
			}).exec(function(error,foundSynchedOrganization){
				if(error) {
					console.log(error);
					callback(false)
				}
				else
				{
					if(!foundSynchedOrganization)
					{
						var orgToUpdate= new synchedOrganizationDefinition({code:synchedOrganization.code,
							lastDateOfRequisitionSync:synchedOrganization.lastDateOfRequisitionSync});
						requestResult=orgToUpdate.save(function(err,result){
							if(err)
							{
								console.log(err);
								callback(false);
							}
							else
							{
								callback(true);
							}
						});
					}
					else
					{
						console.log("Organisation already logged!");
					}
				}
			})//end of exec
}

var saveAllSynchedOrganizations=function (synchedOrganizationList,callBackReturn)
{
	const async = require("async"); 
	var result=false;
	
	async.each(synchedOrganizationList,function(synchedOrganization,callback)
	{
		upsertSynchedOrganization(synchedOrganization,function(response)
		{
			result=response;
			if(response)
			{
				console.log(synchedOrganization.code +"inserted with success.");
			}
			else
			{
				console.log(synchedOrganization.code +"failed to be inserted!");
			}
			callback(response);
		})
	},function(err)
	{
		if(err)
		{
			console.log(err);
			callBackReturn(false);
		}
		if(result)
		{
			callBackReturn(true);
		}
		else
		{
			callBackReturn(false);
		}
		
	});//end of asynch
}
exports.getAllSynchedOrganization=getAllSynchedOrganization;
exports.saveAllSynchedOrganizations=saveAllSynchedOrganizations;
