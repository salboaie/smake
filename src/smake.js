var fs = require("fs");
var ncp = require("ncp");


function createIndex(config, jsFiles, cssFiles, htmlFiles){
    try{
        var template = fs.readFileSync(target["template"]).toString();
        template = template.replace("%REGISTER_STYLES%", cssFiles);
        template = template.replace("%REGISTER_CODE%"  , jsFiles);
        template = template.replace("%REGISTER_VIEWS%" , htmlFiles);
        template = template.replace("%MAIN_VIEW%" , config.mainView);
        template = template.replace("%MAIN_CTRL%" , config.mainCtrl);

        console.log("Creating " + config.target);
        fs.writeFileSync(config.target,template);
    } catch(err){
        console.log("Error: " + err + "\nStack:" +  err.stack);
     throw new Error("Unable to create the target file!");
    }
}

function createSingleJSFile(target, jsFiles, enumerator){
    try{
        var version  = target["version"];
        if(!version){
            version = "1.0";
        }
        var fileName = "js_build"+version+".js";

        console.log("Creating " + fileName);
        fs.unlink(fileName, function(){});

        for(var i = 0; i < jsFiles.length; i++){
            //console.log("Processing " + jsFiles[i]);
            process.stdout.write(".")
            var content = fs.readFileSync(jsFiles[i]).toString();
            fs.appendFileSync(fileName,content);
        }
        console.log(" ");
    } catch(err){
        console.log("Error: " + err + "\nStack:" +  err.stack);
        throw new Error("Unable to create the target file!");
    }
    return enumerator([fileName]);
}


function walk(fileFormat,pathList, collector, callbackCollector){
    var allFiles = {};
    var basePath;
    function recWalk(path, callBack){

        var stat = fs.lstatSync(path);
        if(stat.isDirectory()){
            var files = fs.readdirSync(path);
            for(var i = 0; i< files.length ; i++){
                recWalk(path + "/" + files[i], callBack);
            }
        } else {
            if(allFiles[path] == undefined){
                path = path.replace("//","/");
                path = path.replace(/^\.\//,"");
                if(path.match(fileFormat) != null){
                    allFiles[path] = path;
                    callBack(path);
                }
            }
        }
    }

    for(var i=0; i< pathList.length; i++ ){
        basePath = pathList[i];
        var partialRet = [];
        recWalk(basePath, function(result){
            if(callbackCollector){
                callbackCollector(result, basePath);
            }
            if(collector){
                partialRet.push(result);
            }
        });

        if(collector){
            partialRet.sort(function(a,b){return a.localeCompare(b);});
            partialRet.map(function(v){
                collector.push(v);
            });
        }
    }
}

function resolveJSFiles(config,callBack){
    var ret = [];
    walk(/\.js$/i,target["js"], ret);
    return callBack(ret);
}

function resolveCSSFiles(config, callBack){
    var ret = [];
    walk(/\.css$/i,target["css"], ret);
    return callBack(ret);
}

function resolveHTMLFiles(config, callBack){
    var ret = [];
    walk(/\.html$/i,target["html"], null , function(   file, folder){
        ret.push({"file":file,"folder":folder});
    });
    return callBack(ret);
}

function enumerateJsInHtml(arr){
    var ret = "";
    for(var i=0; i < arr.length; i++){
        ret += '<script type="text/javascript" src="'+arr[i]+'"> </script>\n';
    }
    return ret;
}

function addNameInArray(arr){
    return arr;
}

function minifyJs(arr){
    //todo: put in a single file and minify..
    return "not implemented yet";
}

function enumerateCSSInHtml(arr){
    var ret = "";
    for(var i=0; i < arr.length; i++){
        ret += '<link rel="stylesheet" type="text/css"  href="' + arr[i] + '"/>\n';
    }
    return ret;
}


function compileViews(arr){
    var ret = "";
    for(var i=0; i < arr.length; i++){
        var componentName ;
        componentName = arr[i].file.replace(arr[i].folder,"");
        componentName = componentName.replace(/\.html$/i,"");
        componentName = componentName.replace(/\//g,".");
        componentName = componentName.replace(/^./,"");
        ret += 'shape.registerShapeURL("' +  componentName + '","' + arr[i].file + '");\n';
    }
    return ret;
}


function compactViews(arr){
    var ret = "";
    var fileContent;
    process.stdout.write("Compacting views...")
    for(var i=0; i < arr.length; i++){
        var componentName ;
        componentName = arr[i].file.replace(arr[i].folder,"");
        componentName = componentName.replace(/\.html$/i,"");
        componentName = componentName.replace(/\//g,".");
        componentName = componentName.replace(/^./,"");

        fileContent = encodeURI(fs.readFileSync(arr[i].file, "utf8"));
        ret += 'shape.registerShapeString("' +  componentName + '","' + fileContent + '");\n';
        process.stdout.write(".")
    }
    console.log("");
    return ret;
}




var firstArg = process.argv[2];

try{
    var smakeContent = fs.readFileSync("smakefile");
    try{
        var config = JSON.parse(smakeContent);
    } catch(err){
        console.log("Bad JSON in smakefile ", err);
        return;
    }

    var target;
    var targetName;

    if(firstArg == "--help" || !config[firstArg]){
        console.log("Specify an valid target, as specified in smakefile (eg. release, debug,etc)");
        return ;
    }

    target = config[firstArg];
    targetName = firstArg;

    if(target["release"] ==  "true"){
        console.log("Doing 'release' target: " + targetName);
        if(target["compact_js"] ==  "true")
        {
            var jsFiles  = resolveJSFiles(config, addNameInArray);
            jsFiles   = createSingleJSFile(target, jsFiles, enumerateJsInHtml);
        } else {
            var jsFiles   = resolveJSFiles(config, enumerateJsInHtml);
        }


        var cssFiles  = resolveCSSFiles(config, enumerateCSSInHtml);

        if(target["compact_html"] ==  "true"){
            var htmlFiles = resolveHTMLFiles(config, compactViews);
        } else {
            var htmlFiles = resolveHTMLFiles(config, compileViews);
        }

        createIndex(target, jsFiles, cssFiles, htmlFiles);
    } else {
        console.log("Doing debug target: " + targetName);
        var jsFiles   = resolveJSFiles(config, enumerateJsInHtml);
        var cssFiles  = resolveCSSFiles(config, enumerateCSSInHtml);
        var htmlFiles = resolveHTMLFiles(config, compileViews);
        createIndex(target, jsFiles, cssFiles, htmlFiles);
    }


    var cloneCfg = target["buildCopyTo"];
    if(cloneCfg){
        for(var v in cloneCfg){
            for(var i = 0; i< cloneCfg[v].length; i++){
                console.log("Copying files from " + cloneCfg[v][i] +  " to ", v);
                ncp(cloneCfg[v][i], v + cloneCfg[v][i], function (err) {
                    if (err) {
                        return console.error(err);
                    }
                });
            }
        }
    }

    console.log("Success!");

} catch(err){
    console.log(">>> Build failed!\nError: " + err + "\nStack:" +  err.stack);
}
