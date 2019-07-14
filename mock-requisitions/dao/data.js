var needle = require('needle');
var async = require('async');
var requisitionLists={requisitions:
[
{
	id:"41348",
	programCode:"SIGL-INTEGRE-PNLP",
	facilityCode:"F1372",
	periodStartDate:1522540800000,
	products:[
		{
			productCode:"DLAB0550",
			quantityReceived:43,
			quantityDispensed:23,
			beginningBalance:43,
			totalLossesAndAdjustments:4,
			stockInHand:34,
			amc:12
			
		},
		{
			productCode:"MORA0399",
			quantityReceived:55,
			quantityDispensed:20,
			beginningBalance:22,
			totalLossesAndAdjustments:17,
			stockInHand:7,
			amc:23
			
		},
		{
			productCode:"MORA0371",
			quantityReceived:100,
			quantityDispensed:99,
			beginningBalance:88,
			totalLossesAndAdjustments:23,
			stockInHand:21,
			amc:8
		},
		{
			productCode:"MINJ0369",
			quantityReceived:99,
			quantityDispensed:21,
			beginningBalance:12,
			totalLossesAndAdjustments:5,
			stockInHand:3,
			amc:77
		},
		{
			productCode:"DCON0574",
			quantityReceived:100,
			quantityDispensed:200,
			beginningBalance:21,
			totalLossesAndAdjustments:11,
			stockInHand:21,
			amc:34
		},
		{
			productCode:"MINJ0059",
			quantityReceived:300,
			quantityDispensed:200,
			beginningBalance:312,
			totalLossesAndAdjustments:43,
			stockInHand:21,
			amc:90
		},
		{
			productCode:"MORA0053",
			quantityReceived:98,
			quantityDispensed:77,
			beginningBalance:32,
			totalLossesAndAdjustments:33,
			stockInHand:32,
			amc:2
		}
		,
		{
			productCode:"MORA0052",
			quantityReceived:210,
			quantityDispensed:99,
			beginningBalance:21,
			totalLossesAndAdjustments:12,
			stockInHand:23,
			amc:54
		}
		,
		{
			productCode:"MORA0051",
			quantityReceived:80,
			quantityDispensed:23,
			beginningBalance:0,
			totalLossesAndAdjustments:0,
			stockInHand:12,
			amc:21
		}
		,
		{
			productCode:"MORA0050",
			quantityReceived:30,
			quantityDispensed:21,
			beginningBalance:12,
			totalLossesAndAdjustments:2,
			stockInHand:0,
			amc:23
		}
	]
	
},
{
	id:"41349",
	programCode:"SIGL-INTEGRE-TC",
	facilityCode:"F1372",
	periodStartDate:1522540800000,
	products:[
		{
			productCode:"DLAB0550",
			quantityReceived:46,
			quantityDispensed:13,
			beginningBalance:43,
			totalLossesAndAdjustments:4,
			stockInHand:34,
			amc:12
			
		},
		{
			productCode:"MORA0399",
			quantityReceived:155,
			quantityDispensed:120,
			beginningBalance:22,
			totalLossesAndAdjustments:17,
			stockInHand:7,
			amc:23
			
		},
		{
			productCode:"MORA0371",
			quantityReceived:100,
			quantityDispensed:19,
			beginningBalance:88,
			totalLossesAndAdjustments:23,
			stockInHand:21,
			amc:8
		},
		{
			productCode:"MINJ0369",
			quantityReceived:99,
			quantityDispensed:121,
			beginningBalance:12,
			totalLossesAndAdjustments:5,
			stockInHand:3,
			amc:77
		},
		{
			productCode:"DCON0574",
			quantityReceived:140,
			quantityDispensed:210,
			beginningBalance:21,
			totalLossesAndAdjustments:11,
			stockInHand:21,
			amc:34
		},
		{
			productCode:"MINJ0059",
			quantityReceived:310,
			quantityDispensed:220,
			beginningBalance:321,
			totalLossesAndAdjustments:43,
			stockInHand:21,
			amc:90
		},
		{
			productCode:"MORA0053",
			quantityReceived:981,
			quantityDispensed:717,
			beginningBalance:312,
			totalLossesAndAdjustments:33,
			stockInHand:32,
			amc:2
		}
		,
		{
			productCode:"MORA0052",
			quantityReceived:270,
			quantityDispensed:99,
			beginningBalance:210,
			totalLossesAndAdjustments:123,
			stockInHand:23,
			amc:94
		}
		,
		{
			productCode:"MORA0051",
			quantityReceived:180,
			quantityDispensed:23,
			beginningBalance:1,
			totalLossesAndAdjustments:0,
			stockInHand:12,
			amc:21
		}
		,
		{
			productCode:"MORA0050",
			quantityReceived:130,
			quantityDispensed:211,
			beginningBalance:112,
			totalLossesAndAdjustments:2,
			stockInHand:8,
			amc:23
		}
	]
},
{
	id:"41350",
	programCode:"SIGL-INTEGRE-TC",
	facilityCode:"F1372",
	periodStartDate:1514764800000,
	products:[
		{
			productCode:"DLAB0550",
			quantityReceived:46,
			quantityDispensed:13,
			beginningBalance:43,
			totalLossesAndAdjustments:4,
			stockInHand:34,
			amc:12
			
		},
		{
			productCode:"MORA0399",
			quantityReceived:155,
			quantityDispensed:120,
			beginningBalance:22,
			totalLossesAndAdjustments:17,
			stockInHand:7,
			amc:23
			
		},
		{
			productCode:"MORA0371",
			quantityReceived:100,
			quantityDispensed:19,
			beginningBalance:88,
			totalLossesAndAdjustments:23,
			stockInHand:21,
			amc:8
		},
		{
			productCode:"MINJ0369",
			quantityReceived:99,
			quantityDispensed:121,
			beginningBalance:12,
			totalLossesAndAdjustments:5,
			stockInHand:3,
			amc:77
		},
		{
			productCode:"DCON0574",
			quantityReceived:140,
			quantityDispensed:210,
			beginningBalance:21,
			totalLossesAndAdjustments:11,
			stockInHand:21,
			amc:34
		},
		{
			productCode:"MINJ0059",
			quantityReceived:310,
			quantityDispensed:220,
			beginningBalance:321,
			totalLossesAndAdjustments:43,
			stockInHand:21,
			amc:90
		},
		{
			productCode:"MORA0053",
			quantityReceived:981,
			quantityDispensed:717,
			beginningBalance:312,
			totalLossesAndAdjustments:33,
			stockInHand:32,
			amc:2
		}
		,
		{
			productCode:"MORA0052",
			quantityReceived:270,
			quantityDispensed:99,
			beginningBalance:210,
			totalLossesAndAdjustments:123,
			stockInHand:23,
			amc:94
		}
		,
		{
			productCode:"MORA0051",
			quantityReceived:180,
			quantityDispensed:23,
			beginningBalance:1,
			totalLossesAndAdjustments:0,
			stockInHand:12,
			amc:21
		}
		,
		{
			productCode:"MORA0050",
			quantityReceived:130,
			quantityDispensed:211,
			beginningBalance:112,
			totalLossesAndAdjustments:2,
			stockInHand:8,
			amc:23
		}
	]
}
]}

var requisitionDetais=[
	{
		id:41348,
		programCode:"SIGL-INTEGRE-PNLP",
		agentCode:"F1372",
		emergency:false,
		periodStartDate:1559347200000,
		periodEndDate:1561939199000,
		stringPeriodStartDate:"01/06/2019",
		stringPeriodEndDate:"30/06/2019",
		products:[],
		requisitionStatus:"AUTHORIZED"
	},
	{
		id:41349,
		programCode:"SIGL-INTEGRE-TC",
		agentCode:"F1372",
		emergency:false,
		periodStartDate:1559347200000,
		periodEndDate:1561939199000,
		stringPeriodStartDate:"01/06/2019",
		stringPeriodEndDate:"30/06/2019",
		products:[],
		requisitionStatus:"AUTHORIZED"
	},
	{
		id:41350,
		programCode:"SIGL-INTEGRE-TC",
		agentCode:"F1372",
		emergency:false,
		periodStartDate:1559347200000,
		periodEndDate:1561939199000,
		stringPeriodStartDate:"01/06/2019",
		stringPeriodEndDate:"30/06/2019",
		products:[],
		requisitionStatus:"AUTHORIZED"
	}
]
var listFacilityId=[1372,1380,1381,1382,1383,1384,1385,1386,1387,138];
var listProgramCode=["SIGL-INTEGRE-PNLP","SIGL-INTEGRE-PNMSR","SIGL-INTEGRE-VIH","SIGL-INTEGRE-PNLAT"];
var listProductCode=["MORA0051","MORA0050","MORA0052","MORA0053","MINJ0059","DCON0574","MINJ0369","MORA0371","MORA0399","DLAB0550"];
function generateRandomRequisitions(number,mainCallBack)
{
	var listRequisitionGenerated=[];
	var indicesAsynch=[];
	for(var i=0;i<number;i++)
	{
		indicesAsynch.push(i);
	}
	var counter=1;
	//listRequisitionGenerated
	async.each(indicesAsynch, function(indexAsync, callback) {
		var options={};
		var orchUrl="https://www.google.com";
		needle.get(orchUrl, function(err, resp) {
			//generate a random number between 1 and 10 for listFacilityId index
			console.log(indexAsync+" fake call...");
			var indexFacility= Math.floor(Math.random() * 10);  
			var idFacility=listFacilityId[indexFacility];
			var indexProgramCode= Math.floor(Math.random() *4); 
			var programCode=listProgramCode[indexProgramCode];
			//generate number between 1-30, for date
			var day=Math.floor(Math.random() * 30)+1;
			var generatedDate="2019-04-"+day;
			var timestampStartDate=new Date(generatedDate).getTime();
			//generate 8 product per requisitions
			var indexCodeProductAlreadySelected=[]; 
			while(indexCodeProductAlreadySelected.length<8)
			{
				var indexProduct=Math.floor(Math.random() *10);
				if(indexCodeProductAlreadySelected.includes(indexProduct))
				{
					continue;
				}
				else
				{
					indexCodeProductAlreadySelected.push(indexProduct);
				}
			}
			var listProductSelected=[];
			for(iterator=0;iterator<indexCodeProductAlreadySelected.length;iterator++)
			{
				var index=indexCodeProductAlreadySelected[iterator];
				listProductSelected.push(
					{
						productCode:listProductCode[index],
						quantityReceived:Math.floor(Math.random() *100)+20,
						quantityDispensed:Math.floor(Math.random() *100)+20,
						beginningBalance:Math.floor(Math.random() *100)+20,
						totalLossesAndAdjustments:Math.floor(Math.random() *100)+20,
						stockInHand:Math.floor(Math.random() *100)+20,
						amc:Math.floor(Math.random() *100)+20
					}
				);
			}
			var oRequisition={
				//id:"req"+i,
				id:counter,
				programCode:programCode,
				facilityCode:"F"+idFacility,
				periodStartDate:timestampStartDate,
				products:listProductSelected
				};
			listRequisitionGenerated.push(oRequisition);
			counter++;
			callback();
		});
	},function(err)
	{
		if(err)
		{
			console.log("!!!Error:"+err);
		}
		mainCallBack( {requisitions:listRequisitionGenerated}); 
		//console.log(listRequisitionGenerated);
	});
}
function generateRandomRequisitionsDetails(idRequisition,codeProgram,CodeFacility,mainCallBack)
{
	var indicesAsynch=[1];
	var reqDetails;
	//listRequisitionGenerated
	async.each(indicesAsynch, function(indexAsync, callback) {
		var options={};
		var orchUrl="https://www.radiookapin.net";
		needle.get(orchUrl, function(err, resp) {
			console.log(indexAsync+" fake call...");
			var generatedDate="2019-04-01";
			var timestampStartDate=new Date(generatedDate).getTime();
			var generatedEndDate="2019-04-30";
			var timestampEndDate=new Date(generatedEndDate).getTime();
			var listProductSelected=[];
			for(var i=0;i<listProductCode.length;i++)
			{
				listProductSelected.push(
				{
					productCode:listProductCode[i],
					stockOutDays:Math.floor(Math.random() *100)+20
				}
				);
			}
			reqDetails={
				id:idRequisition,
				programCode:codeProgram,
				agentCode:CodeFacility,
				emergency:false,
				periodStartDate:timestampStartDate,
				periodEndDate:timestampEndDate,
				stringPeriodStartDate:generatedDate,
				stringPeriodEndDate:generatedEndDate,
				products:listProductSelected,
				requisitionStatus:"AUTHORIZED"
			}
			callback();
		});
		
	},function(err)
	{
		if(err)
		{
			console.log("!!Error:"+err);
		}
		mainCallBack( reqDetails); 
	});
	
}
var requisitions=function (callback)
{
	return callback(requisitionLists);
}
var requisitionsGenerated=function (callback)
{
	//var listRequisitionGenerated=generateRandomRequisitions(12);
	generateRandomRequisitions(120,function(listRequisitionGenerated)
	{
		return callback(listRequisitionGenerated);
	});
	//return callback(listRequisitionGenerated);
}
var requisitionsbyId=function (idRequisition,callback)
{
	var foundRequisition=null;
	for(var i=0;i<requisitionDetais.length;i++)
	{
		if(requisitionDetais[i].id==idRequisition)
		{
			foundRequisition={requisition:requisitionDetais[i]};
		}
	}
	return callback(foundRequisition);
}
var generateRequisitionById=function(idRequisition,codeProg,codeFac,callback)
{
	generateRandomRequisitionsDetails(idRequisition,codeProg,codeFac,function(detailRequisition)
	{
		return callback({requisition:detailRequisition});
	});
}
exports.requisitions=requisitions;
exports.requisitionsbyId=requisitionsbyId;
exports.requisitionsGenerated=requisitionsGenerated;
exports.generateRequisitionById=generateRequisitionById;
