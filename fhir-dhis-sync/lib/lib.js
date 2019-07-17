const moment = require('moment');
const url=require('url');
const manifest = require('../config/manifest')
const uuidv1 = require('uuid/v1');
var csvUtil = require('csv-util');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/interopmediator');
var Schema=mongoose.Schema;


exports.getProductName=function(ProductFhir)
{
	var name="";
	for(var iteratorExt=0;iteratorExt<ProductFhir.extension[0].extension.length;iteratorExt++)
	{
		if(ProductFhir.extension[0].extension[iteratorExt].url=="primaryName")
		{
			name=ProductFhir.extension[0].extension[iteratorExt].valueString;
			break;
		}
	}
	return name;
}
exports.getAllDispensingUnitFormProduct=function(ListProductFhir)
{
	var listDispensingUnit=[];
	for(var iterator=0;iterator<ListProductFhir.length;iterator++)
	{
		//if(ListProductFhir[iterator].extension[0].)
		for(var iteratorExt=0;iteratorExt<ListProductFhir[iterator].extension[0].extension.length;iteratorExt++)
		{
			if(ListProductFhir[iterator].extension[0].extension[iteratorExt].url=="dispensingUnit")
			{
				if(listDispensingUnit.includes(ListProductFhir[iterator].extension[0].extension[iteratorExt].valueString))
				{
					continue;
				}
				else
				{
					listDispensingUnit.push(ListProductFhir[iterator].extension[0].extension[iteratorExt].valueString);
				}
			}
		}
	}//end for iterator
	return listDispensingUnit;
}
//this will return an object will id of facility and the list of requisition 
//Not finished implementation
exports.groupRequisitionsByFacility=function (listRequisitions)
{
	listRequisitionsByFacility=[];
	var selectedFacility="";
	for(var iteratorExt=0;iteratorExt<listRequisitions[0].extension[0].extension.length;iteratorExt++)
	{
		if(listRequisitions[iteratorReq].extension[0].extension[iteratorExt].url=="organization")
		{
			var valueReference=listRequisitions[0].extension[0].extension[iteratorExt].valueReference.reference;
			var organizationId=valueReference.split("/")[1];
			selectedFacility.push(organizationId);
			break;
		}
	}
	
	
	//listSelectedFacilities.push(listRequisitions[0])
	
}
exports.getAllProductsInRequisition=function(listRequisition)
{
	listIdProducts=[];
	for(var iteratorReq=0;iteratorReq<listRequisitions.length;iteratorReq++)
	{
		for(var iteratorExt=0;iteratorExt<listRequisitions[iteratorReq].extension[0].extension.length;iteratorExt++)
		{
			if(listRequisitions[iteratorReq].extension[0].extension[iteratorExt].url=="product")
			{
				var valueReference=listRequisitions[iteratorReq].extension[0].extension[iteratorExt].valueReference.reference;
				var productId=valueReference.split("/")[1];
				if(!listIdProducts.includes(productId))
				{
					listIdProducts.push(productId);
				break;
			}
			}
		}
	}
	return listIdProducts;
}
exports.getRequisitionByProgram=function(programId,listRequisitions)
{
	var listRequisitionsFound=[];
	for(var iteratorReq=0;iteratorReq<listRequisitions.length;iteratorReq++)
	{
		//console.log("Level 1:"+listRequisitions[iteratorReq].extension.length);
		for(var iteratorExt=0;iteratorExt<listRequisitions[iteratorReq].extension.length;iteratorExt++)
		{
			//console.log(`Level :${iteratorExt}`);
			//console.log(listRequisitions[iteratorReq].extension[iteratorExt].extension);
			//console.log("---------------------------------------------------");
			for(var iteratorExtDetails=0;iteratorExtDetails<listRequisitions[iteratorReq].extension[iteratorExt].extension.length;iteratorExtDetails++)
			{
				if(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].url=="program")
				{
					//Now check int the program matches the program id
					var valueReference=listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueReference.reference;
					
					var _programId=valueReference.split("/")[1];
					//console.log("found requisition program :"+valueReference);
					if(_programId==programId)
					{
						listRequisitionsFound.push(listRequisitions[iteratorReq]);
						break;
					}
					else
					{
						continue;
					}
				}
				else
				{
					//console.log("Not found requisition program ");
				}
			}
		}
	}
	return listRequisitionsFound;
}

exports.getProgramName=function(ProgramFhir)
{
	var name="";
	for(var iteratorExt=0;iteratorExt<ProgramFhir.extension[0].extension.length;iteratorExt++)
	{
		if(ProgramFhir.extension[0].extension[iteratorExt].url=="name")
		{
			name=ProgramFhir.extension[0].extension[iteratorExt].valueString;
			break;
		}
	}
	return name;
}
//Return the list of Product Id managed by a program
exports.getProgramProductsList=function(ProgramFhir)
{
	var listProduct=[];
	for(var iteratorExt=0;iteratorExt<ProgramFhir.extension[0].extension.length;iteratorExt++)
	{
		if(ProgramFhir.extension[0].extension[iteratorExt].url=="providedProducts")
		{
			//categoryName=ProgramFhir.extension[0].extension[iteratorExt].valueCodeableConcept.text;
			listProduct.push(ProgramFhir.extension[0].extension[iteratorExt].valueReference.reference);
		}
	}
	return listProduct;
}
exports.getCategoryProduct=function(ProgramFhir)
{
	var category=null;
	for(var iteratorExt=0;iteratorExt<ProgramFhir.extension[0].extension.length;iteratorExt++)
	{
		if(ProgramFhir.extension[0].extension[iteratorExt].url=="productCategory")
		{
			//categoryName=ProgramFhir.extension[0].extension[iteratorExt].valueCodeableConcept.text;
			category={
					code:ProgramFhir.extension[0].extension[iteratorExt].valueCodeableConcept.coding[0].code,
					name:ProgramFhir.extension[0].extension[iteratorExt].valueCodeableConcept.text
				};
			break;
		}
	}
	return category;
}
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
