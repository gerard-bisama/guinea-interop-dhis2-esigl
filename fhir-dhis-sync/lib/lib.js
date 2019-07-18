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
//return the CategoryOption of the @programCode
exports.getResourceCategoryIdFromCode=function(resourceCode,listResolvedCategoryOptions)
{
	var resourceId="";
	for(var iteratorCat=0;iteratorCat<listResolvedCategoryOptions.length;iteratorCat++)
	{
		if(listResolvedCategoryOptions[iteratorCat].code==resourceCode)
		{
			resourceId=listResolvedCategoryOptions[iteratorCat].id;
			break;
		}
	}
	return resourceId;
}
var getDispensingUnitFromProduct=function(productCode,ListProductFhir)
{
	var dispensingUnit="";
	for(var iteratorReq=0;iteratorReq<ListProductFhir.length;iteratorReq++)
	{
		if(ListProductFhir[iteratorReq].id!=productCode)
		{
			continue;
		}
		for(var iteratorExt=0;iteratorExt<ListProductFhir[iteratorReq].extension.length;iteratorExt++)
		{
			for(var iteratorExtDetails=0;iteratorExtDetails<ListProductFhir[iteratorReq].extension[iteratorExt].extension.length;iteratorExtDetails++)
			{
				if(ListProductFhir[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].url=="dispensingUnit")
				{
					dispensingUnit=ListProductFhir[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueString;
					found=true;
					break;
				}
			}
			if(found)
			{
				break;
			}
		}
		if(found)
		{
			break;
		}
	}
	
	return dispensingUnit;
}
//Build ADX xml file from requisitionObject
exports.buildADXPayloadFromRequisition=function(requisitionObject)
{
	
}
//return customized list of object DetailsRequisitions
exports.buildObjectDetailsRequisitionList=function(listRequisitions,listProductWithDetails)
{
	listObjectDetailsRequisitions=[];
	for(var iteratorReq=0;iteratorReq<listRequisitions.length;iteratorReq++)
	{
		for(var iteratorExt=0;iteratorExt<listRequisitions[iteratorReq].extension.length;iteratorExt++)
		{
			var requisitionDetails={
				reqId:listRequisitions[iteratorReq].id,
				product:"",
				dispensingUnit:"",
				program:"",
				organization:"",
				initialStock:"",
				receivedQuantity:"",
				consumedQuantity:"",
				losses:"",
				positiveAdjustment:"",
				negativeAdjustment:"",
				stockOnHand:"",
				averageMonthConsumption:"",
				stockOutDay:"",
				startDate:"",
				endDate:""
				};
			for(var iteratorExtDetails=0;iteratorExtDetails<listRequisitions[iteratorReq].extension[iteratorExt].extension.length;iteratorExtDetails++)
			{
				var fieldName=listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].url;
				//var dispensingUnit
				switch(fieldName)
				{
					case "product":
						var productId=listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueReference.reference;
						var codeProduct=productId.split("/")[1];
						//now get the product dispensing unit
						var dispensingUnit=getDispensingUnitFromProduct(codeProduct,listProductWithDetails);
						requisitionDetails.product=codeProduct;
						requisitionDetails.dispensingUnit=dispensingUnit;
						break;
					case "program":
						var programId=listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueReference.reference;
						var codeProgram=programId.split("/")[1];
						requisitionDetails.program=codeProgram;
						break;
					case "organization":
						var valueReference=listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueReference.reference;
						var orgid=valueReference.split("/")[1];
						requisitionDetails.organization=orgid;
						break;
					case "initialStock":
						requisitionDetails.initialStock=parseInt(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDecimal);
						break;
					case "receivedQuantity":
						requisitionDetails.receivedQuantity=parseInt(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDecimal);
						break;
					case "consumedQuantity":
						requisitionDetails.consumedQuantity=parseInt(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDecimal);
						break;
					case "losses":
						requisitionDetails.losses=parseInt(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDecimal);
						break;
					case "positiveAdjustment":
						requisitionDetails.positiveAdjustment=parseInt(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDecimal);
						break;
					case "negativeAdjustment":
						requisitionDetails.negativeAdjustment=parseInt(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDecimal);
						break;
					case "stockOnHand":
						requisitionDetails.stockOnHand=parseInt(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDecimal);
						break;
					case "averageMonthConsumption":
						requisitionDetails.averageMonthConsumption=parseInt(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDecimal);
						break;
					case "stockOutDay":
						requisitionDetails.stockOutDay=parseInt(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDecimal);
						break;
					case "startDate":
						requisitionDetails.startDate=listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDate;
						break;
					case "endDate":
						requisitionDetails.endDate=listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueDate;
						
				}//end switch
				//listObjectDetailsRequisitions.push(requisitionDetails);
			}
			listObjectDetailsRequisitions.push(requisitionDetails);
		}
	}
	return listObjectDetailsRequisitions;
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
exports.getAllProductsInRequisition=function(listRequisitions)
{
	listIdProducts=[];
	for(var iteratorReq=0;iteratorReq<listRequisitions.length;iteratorReq++)
	{
		for(var iteratorExt=0;iteratorExt<listRequisitions[iteratorReq].extension.length;iteratorExt++)
		{
			for(var iteratorExtDetails=0;iteratorExtDetails<listRequisitions[iteratorReq].extension[iteratorExt].extension.length;iteratorExtDetails++)
			{
				if(listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].url=="product")
				{
					var valueReference=listRequisitions[iteratorReq].extension[iteratorExt].extension[iteratorExtDetails].valueReference.reference;
					var productId=valueReference.split("/")[1];
					if(!listIdProducts.includes(productId))
					{
						listIdProducts.push(productId);
					}
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
