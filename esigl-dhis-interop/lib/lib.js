const moment = require('moment');
const url=require('url');
const manifest = require('../config/manifest')
const uuidv1 = require('uuid/v1');
var csvUtil = require('csv-util');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/interopmediator');
var Schema=mongoose.Schema;


//Return a bundle of Organization from the orgunit list
exports.buildOrganizationHierarchy =function buildOrganizationHierarchy(orgUnitList)
{
	//console.log("Entered :"+orgUnitList.length);
	var currentDate=moment().format(new Date().toJSON());
	var currentZFormatDate=formatDateInZform(currentDate);
	var listOfEntries=[];
	var fullUrl;
	for(var i=0;i<orgUnitList.length;i++)
	{

		var oOrgUnit=orgUnitList[i];
		//console.log(oOrgUnit);
		//fullUrl=oOrgUnit.href;
		var  orgUnitHref =url.parse(oOrgUnit.href);
		var identifierCodingSystem=orgUnitHref.protocol+"//"+orgUnitHref.host+"/identifier-type";
		var orgUnitTypeCodingSystem=orgUnitHref.protocol+"//"+orgUnitHref.host+"/organisation-type";
		var oIdentifier=[];
		oIdentifier.push({
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"dhis2Id",display:"dhis2Id"}],text:"dhis2Id"},
				value:oOrgUnit.id

			});
		if(oOrgUnit.code!=null)
		{
			oIdentifier.push(
			{
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"dhis2Code",display:"dhis2Code"}],text:"dhis2Code"},
				value:oOrgUnit.code

			}
			);
		}
		//console.log("Orgunit level:"+oOrgUnit.level);
		var orgUnitLevel=getOrgUnitLevelInformation(oOrgUnit.level);
		var organizationType=[];
		if(orgUnitLevel!=null)
		{
			organizationType.push(
			{coding:[{system:orgUnitTypeCodingSystem,code:"level_"+orgUnitLevel.id,display:"level_"+orgUnitLevel.id}],text:orgUnitLevel.text}
			);
		}
		var isPartOf=null;
		if(oOrgUnit.parent!=null)
		{
			isPartOf={"reference":"Organization/"+oOrgUnit.parent.id};
			//isPartOf={"reference":"Organization/53"};//for testing purpose
		}
		var oOrganization={
			resourceType:"Organization",
			id:oOrgUnit.id,
			meta:{lastUpdated:currentZFormatDate},
			identifier:oIdentifier,
			type:organizationType,
			name:oOrgUnit.displayName,
			partOf:isPartOf

		}
		//console.log(oOrganization);
		var entryUUID=""+new Date().toJSON().replace(/:/g,"-");
		//entryUUID=entryUUID.replace(/./g,"-");
		entryUUID=entryUUID.toLowerCase();
		listOfEntries.push({
			//fullURL:oOrgUnit.href,
			//fullURL:"urn:uuid:"+uuidv1(),
			//fullURL:"http://192.168.1.148:8083/hapi-fhir-jpaserver/fhir/Organization/"+oOrganization.id,
			resource:oOrganization,
			search:{mode:"match"}
			});
	}//end of for
	var idBundle="datasource-"+new Date().toJSON();
	var tempResult=idBundle.replace(/:/g,"");//replace all occurence of : by ""
	idBundle=tempResult.replace(".","");
	var oBundle={
		//id:idBundle,
		id:uuidv1(),
		resourceType : "Bundle",
		type: "collection",
		entry:listOfEntries
		};
	//console.log(JSON.stringify(oBundle));
	return oBundle;
}
//Return the id and the text of orgunit Level
//@param OrgUnitLevel
function getOrgUnitLevelInformation(orgUnitLevel)
{
	var oUnitLevel=null;
	//console.log(manifest.dhis2OrgUnitLevel);
	for (var i=0;i< manifest.dhis2OrgUnitLevel.length;i++)
	{
		var unitLevel=manifest.dhis2OrgUnitLevel[i];
		//console.log(unitLevel);
		//console.log("-----------");
		if(unitLevel.id==orgUnitLevel)
		{
			oUnitLevel=unitLevel;
			break;
		}
	}
	return oUnitLevel;
}
//Return the list of Organization by level as specified in the
exports.getOrganizationByLevel=function getOrganizationByLevel(level,organizationsList)
{
	var organizationsFounded=[];
	for(var indexOrganization=0;indexOrganization<organizationsList.length;indexOrganization++)
	{
		var typeList=organizationsList[indexOrganization].resource.type;
		//console.log(organizationsList[indexOrganization]);
		for(var indexType=0;indexType<typeList.length;indexType++)
		{
			//if(typeList[indexType].coding[0].code=="level" && typeList[indexType].coding[0].display==level)
			if(typeList[indexType].coding[0].code==level)
			{
				organizationsFounded.push(organizationsList[indexOrganization].resource);
			}
		}
	}
	return organizationsFounded;
}
//Update organization from eSIGL Facility and factility-type
exports.updateOrganizationFromeSIGL=function updateOrganizationFromeSIGL(eSIGLFacility,eSIGLFacilityType,oOrganization,hrefDomaineSIGL)
{
	var currentDate=moment().format(new Date().toJSON());
	var currentZFormatDate=formatDateInZform(currentDate);
	var facilityTypeCodingSystem=hrefDomaineSIGL+"/facility-type";
	//var eSIGLType={coding:[{system:facilityTypeCodingSystem,code:"facility-type",display:eSIGLFacilityType.id}],text:eSIGLFacilityType.code};
	var eSIGLType={coding:[{system:facilityTypeCodingSystem,code:eSIGLFacilityType.code,display:eSIGLFacilityType.code}],text:eSIGLFacilityType.code};
	var identifierCodingSystem=hrefDomaineSIGL+"/facility-code";
	var identifier=[{
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"siglcode",display:"siglcode"}],text:"siglcode"},
				value:eSIGLFacility.code},
				{
				use:"official",
				type:{coding:[{system:identifierCodingSystem,code:"siglid",display:"siglid"}],text:"siglid"},
				value:eSIGLFacility.id}
			];
	var oIdentifier=[];
	oIdentifier=oOrganization.identifier;
	oIdentifier.push(identifier[0]);
	oIdentifier.push(identifier[1]);

	var organizationType=[];
	var organizationType=oOrganization.type;
	organizationType.push(eSIGLType);
	var updatedOrganization={
		resourceType:"Organization",
		id:oOrganization.id,
		meta:{lastUpdated:currentZFormatDate},
		identifier:oIdentifier,
		type:organizationType,
		name:oOrganization.name,
		partOf:oOrganization.partOf
			
	};
	return updatedOrganization;
	//updatedOrganization.
}
//Build list of products:Basics extension from the eSIGL products and related list informations
exports.buildProductFhirResources=function buildProductFhirResources(listProducts,listProductCategories,listDosageUnits,hrefDomaineSIGL,hrefDomainFhir)
{
	var listProductsFhir=[];
	var identifierCodingSystem=hrefDomaineSIGL+"/product-id";
	var productExtensionCodingSystem=hrefDomainFhir+"/fhir/StructureDefinition/Product";
	var productCode={coding:[{system:productExtensionCodingSystem,code:"product",display:"product"}],text:"product"};
	for(var i=0;i<listProducts.length;i++)
	{
		var oProduct=listProducts[i];
		var oDosageUnit=getDosageUnit(oProduct.dosageUnitId,listDosageUnits);
		var productDosageUnit={};
		if(oDosageUnit!=null)
		{
			//console.log(oProduct);
			productDosageUnit= {coding:[{system:productExtensionCodingSystem,code:oDosageUnit.code,display:oDosageUnit.code}],text:oDosageUnit.id};
		}
		var identifier=[{
		use:"official",
		type:{coding:[{system:identifierCodingSystem,code:"productid",display:"productid"}],text:"productid"},
		value:oProduct.id
		},
		{
		use:"official",
		type:{coding:[{system:identifierCodingSystem,code:"productcode",display:"productcode"}],text:"productcode"},
		value:oProduct.code
		}
		];
		var oProduct={
			resourceType:"Basic",
			id:oProduct.code,
			identifier:identifier,
			code:productCode,
			extension:[
				{
					url:hrefDomainFhir+"/fhir/ProductDetail",
					extension:
					[
						{
							url:"primaryName",
							valueString:oProduct.primaryName
						},
						{
							url:"fullName",
							valueString:oProduct.fullName
						},
						{
							url:"dosageUnit",
							valueCodeableConcept:productDosageUnit
						},
						{
							url:"dispensingUnit",
							valueString:oProduct.dispensingUnit
						},
						{
							url:"dosePerDispensingUnit",
							valueInteger:oProduct.dosesPerDispensingUnit
						},
						{
							url:"packSize",
							valueInteger:oProduct.packSize
						},
						{
							url:"tracer",
							valueInteger:oProduct.tracer==false?0:1
						}]
				}
				]
		}
		listProductsFhir.push(oProduct);
	}//end of for
	return listProductsFhir;
}
exports.buildProgramFhirResources=function buildProgramFhirResources(listPrograms,hrefDomaineSIGL,hrefDomainFhir)
{
	var listProgramsFhir=[];
	var identifierCodingSystem=hrefDomaineSIGL+"/program-id";
	var programExtensionCodingSystem=hrefDomainFhir+"/fhir/StructureDefinition/Program";
	var programCode={coding:[{system:programExtensionCodingSystem,code:"program",display:"program"}],text:"program"};
	for(var i=0;i<listPrograms.length;i++)
	{
		var oProgram=listPrograms[i];
		var identifier=[{
			use:"official",
			type:{coding:[{system:identifierCodingSystem,code:"programid",display:"programid"}],text:"programid"},
			value:oProgram.id
		},
		{
			use:"official",
			type:{coding:[{system:identifierCodingSystem,code:"programcode",display:"programcode"}],text:"programcode"},
			value:oProgram.code
		}];
		var oProgram={
			resourceType:"OrganizationAffiliation",
			id:oProgram.code,
			identifier:identifier,
			code:programCode,
			extension:[
			{
				url:hrefDomainFhir+"/fhir/ProgramDetails",
				extension:
				[
					{
						url:"name",
						valueString:oProgram.name
					},
					{
						url:"description",
						valueString:oProgram.description
					}]
			}]
		}
		listProgramsFhir.push(oProgram);
		
	}//end for
	return listProgramsFhir;
	
}
exports.buildProgramProductsFhirResources=function buildProgramProductsFhirResources(mainProgram,listProgramsProduct,hrefDomaineSIGL,hrefDomainFhir)
{
	var listProgramsFhir=[];
	var identifierCodingSystem=hrefDomaineSIGL+"/program-id";
	var programProductCodingSystem=hrefDomaineSIGL+"/program-category";
	var programExtensionCodingSystem=hrefDomainFhir+"/fhir/StructureDefinition/Program";
	var programCode={coding:[{system:programExtensionCodingSystem,code:"program",display:"program"}],text:"program"};
	//var oProgram=mainProgram;
		var identifier=[{
			use:"official",
			type:{coding:[{system:identifierCodingSystem,code:"programid",display:"programid"}],text:"programid"},
			value:mainProgram.id
		},
		{
			use:"official",
			type:{coding:[{system:identifierCodingSystem,code:"programcode",display:"programcode"}],text:"programcode"},
			value:mainProgram.code
		}];
	var productCategory={coding:[{system:programProductCodingSystem,code:listProgramsProduct[0].category,display:listProgramsProduct[0].category}],text:listProgramsProduct[0].category};
	var oProgram={
			resourceType:"OrganizationAffiliation",
			id:mainProgram.code,
			identifier:identifier,
			type:programCode,
			productCategory:productCategory,
			extension:[
			{
				url:hrefDomainFhir+"/fhir/ProgramDetails",
				extension:
				[
					{
						url:"name",
						valueString:mainProgram.name
					},
					{
						url:"description",
						valueString:mainProgram.description
					},
					{
						url:"productCategory",
						valueCodeableConcept:productCategory
					}
					
				]
			}]
		};
	var listProvidedProducts=[]
	for(var i=0;i<listProgramsProduct.length;i++)
	{
		oProgram.extension[0].extension.push({
			url:"providedProducts",
			valueReference:{reference:"Basic/"+listProgramsProduct[i].productCode}
		});
	}//end for
	//oProgram.extension[0].extension.push()
	listProgramsFhir.push(oProgram);
	return listProgramsFhir;
}

exports.buildRequisitionFhirResources=function buildRequisitionFhirResources(facilityId,facilityCode,listRequisitions,hrefDomaineSIGL,hrefDomainFhir)
{
	var listRequisitionFhir=[];
	var identifierCodingSystem=hrefDomaineSIGL+"/requisition-id";
	var requisitionExtensionCodingSystem=hrefDomainFhir+"/fhir/StructureDefinition/Requisition";
	var requisitionCode={coding:[{system:requisitionExtensionCodingSystem,code:"requisition",display:"requisition"}],text:"requisition"};
	for(var iteratorReq=0;iteratorReq<listRequisitions.length;iteratorReq++)
	{
		var idRequisition=facilityCode+"-"+listRequisitions[iteratorReq].periodStartDate+"-"+listRequisitions[iteratorReq].programCode;
		var dateTime=new Date(listRequisitions[iteratorReq].periodStartDate).toJSON();
		var dateRequisition=dateTime.split("T")[0];
		var identifier=[{
			use:"official",
			type:{coding:[{system:identifierCodingSystem,code:"requisitioncode",display:"requisitioncode"}],text:"requisitioncode"},
			value:idRequisition
		}];
		//now loop through the product list to build requisitionDetail
		var requisitionDetails=[];
		for(var iteratorProduct=0;iteratorProduct<listRequisitions[iteratorReq].products.length;iteratorProduct++)
		{
			oProduct=listRequisitions[iteratorReq].products[iteratorProduct];
			requisitionDetails.push(
			//[
				{
					url: hrefDomainFhir+"/fhir/requisitionDetail",
					extension:[{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/product",
					//url:hrefDomainFhir+"/fhir/requisitionDetail/product",
					url:"product",
					valueReference:{reference:"Basic/"+oProduct.productCode}
				},
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/program",
					url:"program",
					valueReference:{reference:"OrganizationAffiliation/"+listRequisitions[iteratorReq].programCode}
				}
				,
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/organization",
					url:"organization",
					valueReference:{reference:"Organization/"+facilityId}
				}
				,
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/initialStock",
					url:"initialStock",
					valueDecimal:oProduct.beginningBalance
				}
				,
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/receivedQuantity",
					url:"receivedQuantity",
					valueDecimal:oProduct.quantityReceived
				}
				,
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/consumedQuantity",
					url:"consumedQuantity",
					valueDecimal:oProduct.quantityDispensed
				}
				,
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/losses",
					url:"losses",
					valueDecimal:oProduct.totalLossesAndAdjustments
				}
				,
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/losses",
					url:"positiveAdjustment",
					valueDecimal:0
				}
				,
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/losses",
					url:"negativeAdjustment",
					valueDecimal:0
				}
				,
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/stockOnHand",
					url:"stockOnHand",
					valueDecimal:oProduct.stockInHand
				}
				,
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/stockOnHand",
					url:"averageMonthConsumption",
					valueDecimal:0
				},
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/stockOnHand",
					url:"stockOutDay",
					valueDecimal:0
				}
				,
				{
					url:"startDate",
					valueDate:formatDateInZform(dateRequisition)
				}
				,
				{
					url:"endDate",
					valueDate:""
				}]}
			//]
			);
			//break;
		}//end for products
		var oRequisition={
			resourceType:"Basic",
			id:idRequisition,
			identifier:identifier,
			code:requisitionCode,
			extension:requisitionDetails};
		listRequisitionFhir.push(oRequisition);
	}//end for requisition
	return listRequisitionFhir;
}
//returns the list of requisition filtered by the @startDate
//@stardate: datestring in format "yyyy-mm-dd"
//@list Requisitions by facility
exports.geRequisitionsFromStartDate=function(startDate,listRequisitions)
{
	//convert the date string in date
	var definedStartDate=new Date(startDate);
	//console.log(`${startDate} to ${definedStartDate}`)
	var listSelectedRequisitions=[];
	for(var iterator=0;iterator<listRequisitions.length;iterator++)
	{
		var dateRequisition=new Date(listRequisitions[iterator].periodStartDate);
		//console.log(`${dateRequisition}>=${definedStartDate}`)
		if(dateRequisition>=definedStartDate)
		{
			
			listSelectedRequisitions.push(listRequisitions[iterator]);
		}
		else //Not selected requisition
		{
			console.log(`Requisition not retained since the periodStartDate is ${dateRequisition}`);
		}
		
	}
	return listSelectedRequisitions;
}
var getFacilityeSiGLCode=function (organization)
{
	var eSigleCode=null;
	//console.log(organization.identifier);
	for(var i=0;i<organization.identifier.length;i++)
	{
		var oIdentifier=organization.identifier[i];
		if(oIdentifier.type.coding[0].code=="siglcode")
		{
			eSigleCode=oIdentifier.value;
			break;
		}
	}
	return eSigleCode;
}
//return a dosage unit form the list by id
//@@dosageUnitId, the id of the dosage unit
function getDosageUnit(dosageUnitId,listDosageUnits)
{
	var oDosageUnit=null;
	for(var i=0;i<listDosageUnits.length;i++)
	{
		if (listDosageUnits[i].id==dosageUnitId)
		{
			oDosageUnit=listDosageUnits[i];
			break
		}
	}
	return oDosageUnit;
}
//return a product-category form the list by id
//@@productCategoryId, the id of the productCategory
function getProductCategory(productCategoryId,listProductCategories)
{
	var oProductCategory=null;
	for(var i=0;i<listProductCategories.length;i++)
	{
		if (listProductCategories[i].id==productCategoryId)
		{
			oProductCategory=listProductCategories[i];
			break
		}
	}
	return oProductCategory;
}
//return a program form the list by programCode
//@@programCode, the code of the program
exports.getProgramFromList=function (programCode,listPrograms)
{
	var oProgram=null;
	for(var i=0;i<listPrograms.length;i++)
	{
		if (listPrograms[i].code==programCode)
		{
			oProgram=listPrograms[i];
			break
		}
	}
	return oProgram;
}

//check if the eSIGL-Organizatin mapping has been done already
exports.checkOrganizationAlreadyMapped=function checkOrganizationAlreadyMapped(organization)
{
	var found=false;
	var listIdentifier=organization.identifier;
	for(var i=0;i<listIdentifier.length;i++)
	{
		var oIdentifier=listIdentifier[i];
		if(oIdentifier.type.coding[0].code=="siglcode" || oIdentifier.type.coding[0].code=="siglid")
		{
			found=true;
			break;
		}
	}
	return found;
}
//return eSIGL facility matches the id
exports.getFacilityInTheListFromId=function getFacilityInTheListFromId(idToSearch,listOfFacility)
{
	var found=null;
	for(var i=0;i<listOfFacility.length;i++)
	{
		//console.log(""+listOfFacility[i].id+"==""+idToSearch);
		if(""+listOfFacility[i].id==""+idToSearch)
		{
			found=listOfFacility[i];
			break;
		}
	}
	return found;
}
//return eSIGL facility-type matches the id
exports.getFacilityTypeInTheListFromId=function getFacilityTypeInTheListFromId(idToSearch,listOfFacilityTypes)
{
	var found=null;
	for(var i=0;i<listOfFacilityTypes.length;i++)
	{
		if(""+listOfFacilityTypes[i].id==""+idToSearch)
		{
			found=listOfFacilityTypes[i];
			break;
		}
	}
	return found;
}
//return the list of organization from fhir not synched in mongodb log
//@@ batchSize : the limit size of the returned result
//@@ listSynchedOrganizations the list of {code,date} from mongodb log
//@@ listOrganizations of all organization from fhir
exports.getOrganizationsNotSynched=function getOrganizationsNotSynched(batchSize,listSynchedOrganizations,listOrganizations)
{
	var listSelectedOrganizations=[];
	//console.log("Size list synched org :"+listSynchedOrganizations.length);
	if(listSynchedOrganizations.length>0)
	{
		for(var iteratorOrg=0;iteratorOrg<listOrganizations.length;iteratorOrg++)
		{
			var organization=listOrganizations[iteratorOrg];
			var found=false;
			for(var iteratorsync=0;iteratorsync<listSynchedOrganizations.length;iteratorsync++)
			{
				var organizationCode=getFacilityeSiGLCode(organization);
				if (listSynchedOrganizations[iteratorsync].code==organizationCode)
				{
					found=true;
					break;
				}
			}
			if(found)
			{
				continue;
			}
			else
			{
				listSelectedOrganizations.push(organization)
				if(listSelectedOrganizations.length>=batchSize)
				{
					break;
				}
			}
		}
	}
	else
	{
		for(var iteratorOrg=0;iteratorOrg<listOrganizations.length;iteratorOrg++)
		{
			listSelectedOrganizations.push(listOrganizations[iteratorOrg]);
			if(listSelectedOrganizations.length>=batchSize)
			{
				break;
			}
		}
	}
	
	return listSelectedOrganizations;
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
exports.getFacilityeSiGLCode=getFacilityeSiGLCode;
