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
	//console.log(identifier);
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
exports.buildProgramProductsFhirResources=function buildProgramProductsFhirResources(mainProgram,listProductCategories,listProgramsProduct,hrefDomaineSIGL,hrefDomainFhir)
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
	var codeCatProduct=getProductCategoryCodeFromName(listProgramsProduct[0].category,listProductCategories);
	var productCategory={coding:[{system:programProductCodingSystem,code:codeCatProduct,display:listProgramsProduct[0].category}],text:listProgramsProduct[0].category};
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
function getProductCategoryCodeFromName(categoryName,listProductCategories)
{
	var foundCode="";
	for(var i=0;i<listProductCategories.length;i++)
	{
		if(categoryName==listProductCategories[i].name)
		{
			foundCode=listProductCategories[i].code;
			break;
		}
	}
	return foundCode;
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
function getStockOutDaysFromRequisitionDetails(idRequisition,productCode, listRequisitionDetails)
{
	var stockOutDays=0;
	for(var iteratorReq=0;iteratorReq<listRequisitionDetails.length;iteratorReq++)
	{
		
		if(listRequisitionDetails[iteratorReq].id==idRequisition)
		{
			var oRequisition=listRequisitionDetails[iteratorReq];
			//now loop through product to get the stockoutdays informations
			for(var iteratorProd=0;iteratorProd<oRequisition.products.length;iteratorProd++)
			{
				if(oRequisition.products[iteratorProd].productCode==productCode)
				{
					stockOutDays=oRequisition.products[iteratorProd].stockOutDays;
					break;
				}
			}
		}
	}
	return stockOutDays;
}
exports.buildRequisitionFhirResourcesNewApi=function buildRequisitionFhirResourcesNewApi(requisitionStatusToProcess,prefixIdResource,listFacility,listRequisitionDetails,listRequisitions,hrefDomaineSIGL,hrefDomainFhir)
{
	//console.log(listFacility);
	var listRequisitionFhir=[];
	var identifierCodingSystem=hrefDomaineSIGL+"/requisition-id";
	var requisitionExtensionCodingSystem=hrefDomainFhir+"/fhir/StructureDefinition/Requisition";
	var requisitionCode={coding:[{system:requisitionExtensionCodingSystem,code:"requisition",display:"requisition"}],text:"requisition"};
	
	for(var iteratorReq=0;iteratorReq<listRequisitions.length;iteratorReq++)
	{
		var idRequisition=prefixIdResource+listRequisitions[iteratorReq].id;
		var requisitionDetails=getRequisitionDetailsById(prefixIdResource,idRequisition,listRequisitionDetails);
		//Skip all requisition with status different from requisitionStatuus to process.Default to "APPROVED"
		if(requisitionDetails.requisitionStatus!=requisitionStatusToProcess)
		{
			continue;
		}
		var dateTimeStartDate=new Date(requisitionDetails.periodStartDate).toJSON();
		var dateTimeEndDate=new Date(requisitionDetails.periodEndDate).toJSON();
		var createdDate=moment().format(dateTimeStartDate);
		var createdDateZFormat=formatDateInZform(createdDate);
		var startDate=dateTimeStartDate.split("T")[0];
		var endDate=dateTimeEndDate.split("T")[0];
		var OrganizationId=getOrganizationFhirIdFromCode(requisitionDetails.agentCode,listFacility);
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
					valueReference:{reference:"Organization/"+OrganizationId}
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
					valueDecimal:oProduct.amc
				},
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/stockOnHand",
					url:"stockOutDay",
					valueDecimal:getStockOutDaysFromRequisitionDetails(listRequisitions[iteratorReq].id,oProduct.productCode,listRequisitionDetails)
				}
				,
				{
					url:"startDate",
					valueDate:formatDateInZform(startDate)
				}
				,
				{
					url:"endDate",
					valueDate:formatDateInZform(endDate)
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
			created:createdDateZFormat,
			extension:requisitionDetails};
		listRequisitionFhir.push(oRequisition);
	}//end for requisition
	return listRequisitionFhir;
}
exports.buildRequisitionFhirResourcesNewApiByProducts=function buildRequisitionFhirResourcesNewApi(requisitionStatusToProcess,prefixIdResource,listFacility,listRequisitionDetails,listRequisitions,hrefDomaineSIGL,hrefDomainFhir)
{
	//console.log(listFacility);
	var listRequisitionFhir=[];
	var identifierCodingSystem=hrefDomaineSIGL+"/requisition-id";
	var requisitionExtensionCodingSystem=hrefDomainFhir+"/fhir/StructureDefinition/Requisition";
	var requisitionCode={coding:[{system:requisitionExtensionCodingSystem,code:"requisition",display:"requisition"}],text:"requisition"};
	
	for(var iteratorReq=0;iteratorReq<listRequisitions.length;iteratorReq++)
	{
		var idRequisition=prefixIdResource+listRequisitions[iteratorReq].id;
		var requisitionDetails=getRequisitionDetailsById(prefixIdResource,idRequisition,listRequisitionDetails);
		//Skip all requisition with status different from requisitionStatuus to process.Default to "APPROVED"
		if(requisitionDetails.requisitionStatus!=requisitionStatusToProcess)
		{
			continue;
		}
		var dateTimeStartDate=new Date(requisitionDetails.periodStartDate).toJSON();
		var dateTimeEndDate=new Date(requisitionDetails.periodEndDate).toJSON();
		var createdDate=moment().format(dateTimeStartDate);
		var createdDateZFormat=formatDateInZform(createdDate);
		var startDate=dateTimeStartDate.split("T")[0];
		var endDate=dateTimeEndDate.split("T")[0];
		var OrganizationId=getOrganizationFhirIdFromCode(requisitionDetails.agentCode,listFacility);
		
		//now loop through the product list to build requisitionDetail
		
		for(var iteratorProduct=0;iteratorProduct<listRequisitions[iteratorReq].products.length;iteratorProduct++)
		{
			var requisitionDetails=[];
			var newIdRequisition=idRequisition+listRequisitions[iteratorReq].products[iteratorProduct].productCode+listRequisitions[iteratorReq].programCode;
			var identifier=[{
			use:"official",
			type:{coding:[{system:identifierCodingSystem,code:"fhirrequisitioncode",display:"fhirrequisitioncode"}],text:"fhirrequisitioncode"},
			value:idRequisition+listRequisitions[iteratorReq].products[iteratorProduct].productCode+listRequisitions[iteratorReq].programCode
		},
		{
			use:"official",
			type:{coding:[{system:identifierCodingSystem,code:"siglrequisitioncode",display:"siglrequisitioncode"}],text:"siglrequisitioncode"},
			value:idRequisition
		}
		];
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
					valueReference:{reference:"Organization/"+OrganizationId}
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
					valueDecimal:oProduct.amc
				},
				{
					//url:hrefDomainFhir+"/fhir/requisitionDetail/stockOnHand",
					url:"stockOutDay",
					valueDecimal:getStockOutDaysFromRequisitionDetails(listRequisitions[iteratorReq].id,oProduct.productCode,listRequisitionDetails)
				}
				,
				{
					url:"startDate",
					valueDate:formatDateInZform(startDate)
				}
				,
				{
					url:"endDate",
					valueDate:formatDateInZform(endDate)
				}]}
			//]
			);
			//break;
			var oRequisition={
			resourceType:"Basic",
			id:newIdRequisition,
			identifier:identifier,
			code:requisitionCode,
			created:createdDateZFormat,
			extension:requisitionDetails};
			listRequisitionFhir.push(oRequisition);
		}//end for products
		
	}//end for requisition
	return listRequisitionFhir;
}

//return the requisitions details by id 
//@id of the requisition to search in the lists
//@listRequisitionsDetails that contains requisition to loop through
function getRequisitionDetailsById(prefixId,id,listRequisitions)
{
	var foundRequisition=null;
	for(var i=0;i<listRequisitions.length;i++)
	{
		if(prefixId+listRequisitions[i].id==id)
		{
			foundRequisition=listRequisitions[i];
			break;
		}
	}
	return foundRequisition;
}
//Return the OrganizationId from Organization simplified object
//@eSiglCode of the agentCode from requisition
//listOrganization list simplified organizations
function getOrganizationIdFromCode(eSiglCode,listOrganization)
{
	var idFound=null;
	for(var i=0;i<listOrganization.length;i++)
	{
		if(listOrganization[i].eSiglCode==eSiglCode)
		{
			idFound=listOrganization[i].id;
			break;
		}
	}
	return idFound;
}
function getOrganizationFhirIdFromCode(eSiglCode,listOrganizationFhir)
{
	var idFound=null;
	for(var indexList=0;indexList<listOrganizationFhir.length;indexList++)
	{
		var organization=listOrganizationFhir[indexList];
		for(var indexId=0;indexId<organization.identifier.length;indexId++)
		{
			oIdentifier=organization.identifier[indexId];
			if(oIdentifier.type.coding[0].code=="siglcode" &&  oIdentifier.value==eSiglCode)
			{
				idFound=organization.id;
				break;
			}
			
		}
		if(idFound!=null)
		{
			break;
		}
	}
	return idFound
}
//returns the list of requisition filtered by the @startDate
//@stardate: datestring in format "yyyy-mm-dd"
//@list Requisitions by facility
exports.geRequisitionsFromStartDate=function(startDate,listRequisitions)
{
	//console.log(listRequisitions);
	//convert the date string in date
	var definedStartDate=new Date(startDate);
	//console.log(`${startDate} to ${definedStartDate}`)
	var listSelectedRequisitions=[];
	for(var iterator=0;iterator<listRequisitions.length;iterator++)
	{
		var dateRequisition=new Date(listRequisitions[iterator].periodStartDate);
		//console.log(listRequisitions[iterator]);
		//console.log(`${dateRequisition}>=${definedStartDate}`)
		if(dateRequisition>definedStartDate)
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
//returns the list of requisition filtered by the period @startDate-@endDate
//@startDate: datestring in format "yyyy-mm-dd"
//@endDate: datestring in format "yyyy-mm-dd"
//@list Requisitions by facility
exports.geRequisitionsPeriod=function(startDate,endDate,listRequisitions)
{
	//convert the date string in date
	var definedStartDate=new Date(startDate);
	var definedEndDate=new Date(endDate);
	//console.log(`${startDate} to ${definedStartDate}`)
	var listSelectedRequisitions=[];
	for(var iterator=0;iterator<listRequisitions.length;iterator++)
	{
		var dateRequisition=new Date(listRequisitions[iterator].periodStartDate);
		//console.log(`${dateRequisition}>=${definedStartDate}`)
		if(dateRequisition>=definedStartDate && dateRequisition<=definedEndDate)
		{
			
			listSelectedRequisitions.push(listRequisitions[iterator]);
		}
		else //Not selected requisition
		{
			console.log(`Requisition not retained since the periodStartDate in period is ${dateRequisition}`);
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
exports.getMaxStartDatePeriode=function getMaxStartDatePeriode(listRequisitions)
{
	
    var  max=listRequisitions[0].periodStartDate;
    for(var i=1;i<listRequisitions.length;i++)
    {
		if(max<listRequisitions[i].periodStartDate)
		{
			max=listOfStartDatePeriod[i].periodStartDate;
		}
		else
		{
			continue;
		}
	}
	return max;
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
				//var organizationCode=getFacilityeSiGLCode(organization);
				if (listSynchedOrganizations[iteratorsync].orgid==organization.id)
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
//return the list of requisitions from eSIGL not synched in mongodb log
//@@ batchSize : the limit size of the returned result
//@@ listSynchedRequisitions the list of {code,date} from mongodb log
//@@ listRequisitions the list of all requisitions from fhir
exports.getRequisitionsNotSynched=function getRequisitionsNotSynched(prefixIdResource,batchSize,listSynchedRequisitions,listRequisitions,listProgramToProcess)
{
	var listSelectedRequisitions=[];
	if(listSynchedRequisitions.length>0)
	{
		for(var iterator=0;iterator<listRequisitions.length;iterator++)
		{
			var requisition=listRequisitions[iterator];
			if(!listProgramToProcess.includes(requisition.programCode))
			{
				continue;
			}
			var found=false;
			for(var iteratorSync=0;iteratorSync<listSynchedRequisitions.length;iteratorSync++)
			{
				//var synchCode=requisition.id;
				//console.log(`Synched resource selection : ${listSynchedRequisitions[iteratorSync].}==${prefixIdResource+requisition.id}`);
				if (listSynchedRequisitions[iteratorSync].reqid==prefixIdResource+requisition.id)
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
				listSelectedRequisitions.push(requisition)
				if(listSelectedRequisitions.length>=batchSize)
				{
					break;
				}
			}
		}
	}
	else
	{
		for(var iteratorSync=0;iteratorSync<listRequisitions.length;iteratorSync++)
		{
			listSelectedRequisitions.push(listRequisitions[iteratorSync]);
			if(listSelectedRequisitions.length>=batchSize)
			{
				break;
			}
		}
	}
	return listSelectedRequisitions;
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
	lastDateOfRequisitionSync:Date
});
var requisitionSyncLogSchema=Schema({
	reqid:String, //by default 1
	minperiodstartdate:Date,
	maxperiodstartdate:Date
});
var organizationSyncLogSchema=Schema({
	orgid:String, //by default 1
	minperiodstartdate:Date,
	maxperiodstartdate:Date
});

var mappingSyncLogSchema=Schema({
	facilityId:String, 
	syncDate:Date
});
var facilitySyncLogSchema=Schema({
	code:{type:String,default:"1"},//by default 1
	pageCount:String, 
	current:{type:Number,default:1},
	dateOperation:Date
});
var facilitySiglSyncLogSchema=Schema({
	code:{type:String,default:"1"},//by default 1
	pageCount:String, 
	current:{type:Number,default:1},
	dateOperation:Date
});
var synchedOrganizationDefinition=mongoose.model('synchedOrganization',organizationSchema);
var synchedRequisitionDefinition=mongoose.model('synchedRequisition',requisitionSyncSchema);
var requisitionSyncLogDefinition=mongoose.model('requisitionSyncLog',requisitionSyncLogSchema);//keep log of synched requisition new API
var organizatinSyncLogDefinition=mongoose.model('organizationSyncLog',organizationSyncLogSchema);//keep log of synched organization within a specific period new API
var facilitySyncLogDefinition=mongoose.model('facilitySyncLog',facilitySyncLogSchema);
var facilitySIGLSyncLogDefinition=mongoose.model('facilitySiglSyncLog',facilitySiglSyncLogSchema);//keep log of counter interation when looping though the esigl facilityList API, since it return a set of repeated facility for each page
var mappingSyncLogDefinition=mongoose.model('mappingSyncLog',mappingSyncLogSchema);//keep esigklfacilityid of mapped facility
//return the list of organization which requisition has been already synched
var getAllSynchedOrganization=function (callback)
{
	var requestResult=synchedOrganizationDefinition.find({}).exec(function(error,synchedOrganizationsList){
		if(error) return handleError(err);
		return callback(synchedOrganizationsList);
		});
}
var getAllMappingSync=function (callback)
{
	var requestResult=mappingSyncLogDefinition.find({}).exec(function(error,synchedMapping){
		if(error) return handleError(err);
		return callback(synchedMapping);
		});
}
var getAllSynchedRequisitionsByFacility=function (callback)
{
	var requestResult=synchedRequisitionDefinition.find({}).exec(function(error,synchedRequisitionsList){
		if(error) return handleError(err);
		return callback(synchedRequisitionsList);
		});
}
var getAllRequisitionPeriodSynched=function(minStartDate,maxStartDate,callback)
{
	var _minStartDate=new Date(minStartDate);
	var _maxStartDate=new Date(maxStartDate);
	if(maxStartDate!="")
	{
		var requestResult=requisitionSyncLogDefinition.find({"minperiodstartdate":{$gte:_minStartDate,$lte:_maxStartDate}},{"_id":0}).exec(function(error,synchedRequisitionsList){
		if(error) return handleError(err);
		//return callback(synchedMaxperiod.maxperiodstartdate);
		//return callback(synchedRequisitionsList);
		var async = require('async');
		var arrayList=[];
		async.each(synchedRequisitionsList, function(synchedRequisition, callbackAsync) {
			arrayList.push(synchedRequisition);
			callbackAsync();
		},function(err)
		{
			return callback(arrayList);
			
			});//end asynch
		});
	}
	else
	{
		var requestResult=requisitionSyncLogDefinition.find({"minperiodstartdate":{$gte:_minStartDate}},{"_id":0}).exec(function(error,synchedRequisitionsList){
		if(error) return handleError(err);
		//return callback(synchedMaxperiod.maxperiodstartdate);
		return callback(synchedRequisitionsList);
		});
	}
	
}
var getAllOrganizationPeriodSynched=function(minStartDate,maxStartDate,callback)
{
	var _minStartDate=new Date(minStartDate);
	var _maxStartDate=new Date(maxStartDate);
	if(maxStartDate!="")
	{
		var requestResult=organizatinSyncLogDefinition.find({"minperiodstartdate":{$gte:_minStartDate,$lte:_maxStartDate}},{"_id":0}).exec(function(error,synchedOrganizationList){
		if(error) {return handleError(err);}
		var async = require('async');
		var arrayList=[];
		async.each(synchedOrganizationList, function(synchedOrganization, callbackAsync) {
			arrayList.push(synchedOrganization);
			callbackAsync();
		},function(err)
		{
			return callback(arrayList);
			
			});//end asynch
		});
	}
	else
	{
		var requestResult=organizatinSyncLogDefinition.find({"minperiodstartdate":{$gte:_minStartDate}},{"_id":0}).exec(function(error,synchedOrganizationList){
		if(error) return handleError(err);
		//return callback(synchedMaxperiod.maxperiodstartdate);
		return callback(synchedOrganizationList);
		});
	}
	
}
var updateRequisitionMaxPeriodStartDateSynched=function (_maxPeriodStartDate,callback)
{
	requisitionSyncLogDefinition.findOneAndUpdate({code:"1"},{$set:{maxperiodstartdate:_maxPeriodStartDate}},{upsert:true},(err, doc) => {
		if (err) {
			console.log("Error: Failed to update the record maxperiodstartdate!");
		}
		console.log(true)
	}
	)
}
var upDateLogSyncFacility=function (_dateOperation,_pageCount,callback)
{
	var res=facilitySyncLogDefinition.findOneAndUpdate({code:"1"},{$set:{dateOperation:_dateOperation,pageCount:_pageCount},$inc:{current:1}},{upsert:true},(err, doc) => {
		if (err) {
			console.log("Error: Failed to update the facility log sync record!");
			callback(false);
		}
		else
		{
			callback(true);
		}})
		
}
var upDateLogSyncFacilityeSigl=function (_dateOperation,_pageCount,callback)
{
	var res=facilitySIGLSyncLogDefinition.findOneAndUpdate({code:"1"},{$set:{dateOperation:_dateOperation,pageCount:_pageCount},$inc:{current:1}},{upsert:true},(err, doc) => {
		if (err) {
			console.log("Error: Failed to update the esigl facility log sync record!");
			callback(false);
		}
		else
		{
			callback(true);
		}})
		
}
var getSyncLogFacility=function(_dateOperation,callback)
{
	var requestResult=facilitySyncLogDefinition.findOne({"code":"1","dateOperation":{$eq:_dateOperation}},{"_id":0}).exec(function(error,doc){
		if(error) {
			console.log("Error: Failed to get the facility log sync record!");
			callback (null);
		}
		else
		{
			callback(doc);
		}
		
		});
}
var getSyncLogFacilityeSigl=function(_dateOperation,callback)
{
	var requestResult=facilitySIGLSyncLogDefinition.findOne({"code":"1","dateOperation":{$eq:_dateOperation}},{"_id":0}).exec(function(error,doc){
		if(error) {
			console.log("Error: Failed to get the esigl facility log sync record!");
			callback (null);
		}
		else
		{
			callback(doc);
		}
		
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
var upsertSynchedRequisition=function(synchedRequisition,callback)
{
	synchedRequisitionDefinition.findOne({
			code:synchedRequisition.code,
			}).exec(function(error,foundSynchedRequisition){
				if(error) {
					console.log(error);
					callback(false)
				}
				else
				{
					if(!foundSynchedRequisition)
					{
						var reqToUpdate= new synchedRequisitionDefinition({code:synchedRequisition.code,
							lastDateOfRequisitionSync:synchedRequisition.lastDateOfRequisitionSync});
						requestResult=reqToUpdate.save(function(err,result){
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
						console.log("Requisition already logged!");
					}
				}
			})//end of exec
}
var upsertSynchedRequisitionPeriod=function(minStartDate,maxStartDate,synchedRequisitionId,callback)
{
	requisitionSyncLogDefinition.findOne({
			reqid:synchedRequisitionId,
			}).exec(function(error,foundSynchedRequisition){
				if(error) {
					console.log(error);
					callback(false)
				}
				else
				{
					if(!foundSynchedRequisition)
					{
						
						var reqToUpdate= new requisitionSyncLogDefinition({reqid:synchedRequisitionId,
							minperiodstartdate:minStartDate,maxperiodstartdate:maxStartDate});
						
						var requestResult=reqToUpdate.save(function(err,result){
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
						console.log("Requisition already logged!");
					}
				}
			})//end of exec
}
var upsertSynchedOrganizationPeriod=function(minStartDate,maxStartDate,synchedFacilityId,callback)
{
	organizatinSyncLogDefinition.findOne({
			orgid:synchedFacilityId,minperiodstartdate:{$gte:maxStartDate,$lte:maxStartDate}
			}).exec(function(error,foundSynchedOrganization){
				if(error) {
					console.log(error);
					callback(false)
				}
				else
				{
					console.log("------------------------------------------------");
					console.log(foundSynchedOrganization);
					if(!foundSynchedOrganization)
					{
						
						var orgToUpdate= new organizatinSyncLogDefinition({orgid:synchedFacilityId,
							minperiodstartdate:minStartDate,maxperiodstartdate:maxStartDate});
						
						var requestResult=orgToUpdate.save(function(err,result){
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
						console.log("Organization already logged for requisition!");
					}
				}
			})//end of exec
}
var upsertMappingSync=function(_syncDate,_facilityId,callback)
{
	mappingSyncLogDefinition.findOne({
			facilityId:_facilityId,
			}).exec(function(error,foundSynchedMapping){
				if(error) {
					console.log(error);
					callback(false)
				}
				else
				{
					if(!foundSynchedMapping)
					{
						
						var reqToUpdate= new mappingSyncLogDefinition({facilityId:_facilityId,
							syncDate:_syncDate});
						
						var requestResult=reqToUpdate.save(function(err,result){
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
						console.log("Mapping already logged!");
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
var saveAllSynchedRequisitions=function (synchedRequisitionList,callBackReturn)
{
	const async = require("async"); 
	var result=false;
	
	async.each(synchedRequisitionList,function(synchedRequisition,callback)
	{
		upsertSynchedRequisition(synchedRequisition,function(response)
		{
			result=response;
			if(response)
			{
				console.log(synchedRequisition.code +"inserted with success.");
			}
			else
			{
				console.log(synchedRequisition.code +"failed to be inserted!");
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
var saveAllSynchedRequisitionsPeriod=function (minStartDate,maxStartDate,synchedRequisitionList,callBackReturn)
{
	const async = require("async"); 
	var result=false;
	var _minStartDate=new Date(minStartDate);
	var _maxStartDate= new Date(maxStartDate);
	//console.log(`requestString => ${_minStartDate} : ${_maxStartDate}`);
	async.each(synchedRequisitionList,function(synchedRequisition,callback)
	{
		upsertSynchedRequisitionPeriod(_minStartDate,_maxStartDate,synchedRequisition.id,function(response)
		{
			result=response;
			if(response)
			{
				console.log(synchedRequisition.id +"inserted with success.");
			}
			else
			{
				console.log(synchedRequisition.id +"failed to be inserted!");
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
var saveAllSynchedOrganizationPeriod=function (minStartDate,maxStartDate,synchedOrganizationsList,callBackReturn)
{
	const async = require("async"); 
	var result=false;
	var _minStartDate=new Date(minStartDate);
	var _maxStartDate= new Date(maxStartDate);
	//console.log(`requestString => ${_minStartDate} : ${_maxStartDate}`);
	async.each(synchedOrganizationsList,function(synchedOrganization,callback)
	{
		upsertSynchedOrganizationPeriod(_minStartDate,_maxStartDate,synchedOrganization.id,function(response)
		{
			result=response;
			if(response)
			{
				console.log(synchedOrganization.id +" inserted with success.");
			}
			else
			{
				console.log(synchedOrganization.id +" failed to be inserted!");
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
var saveAllSynchedMapping=function (syncDate,synchedMappingList,callBackReturn)
{
	const async = require("async"); 
	var result=false;
	
	//console.log(`requestString => ${_minStartDate} : ${_maxStartDate}`);
	async.each(synchedMappingList,function(synchedMapping,callback)
	{
		upsertMappingSync(syncDate,synchedMapping,function(response)
		{
			result=response;
			if(response)
			{
				//console.log(synchedMapping +"inserted with success.");
			}
			else
			{
				//console.log(synchedMapping +"failed to be inserted!");
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
exports.getAllSynchedRequisitionsByFacility=getAllSynchedRequisitionsByFacility;
exports.saveAllSynchedRequisitions=saveAllSynchedRequisitions;
exports.getFacilityeSiGLCode=getFacilityeSiGLCode;
exports.getAllMappingSync=getAllMappingSync;
//exports.getRequisitionMaxPeriodStartDateSynched=getRequisitionMaxPeriodStartDateSynched;
exports.getAllRequisitionPeriodSynched=getAllRequisitionPeriodSynched;
exports.getAllOrganizationPeriodSynched=getAllOrganizationPeriodSynched;                                                                          
exports.saveAllSynchedRequisitionsPeriod=saveAllSynchedRequisitionsPeriod;
exports.updateRequisitionMaxPeriodStartDateSynched=updateRequisitionMaxPeriodStartDateSynched;
exports.upDateLogSyncFacility=upDateLogSyncFacility;
exports.upDateLogSyncFacilityeSigl=upDateLogSyncFacilityeSigl;
exports.getSyncLogFacility=getSyncLogFacility;
exports.getSyncLogFacilityeSigl=getSyncLogFacilityeSigl;
exports.saveAllSynchedMapping=saveAllSynchedMapping;
exports.saveAllSynchedOrganizationPeriod=saveAllSynchedOrganizationPeriod;
