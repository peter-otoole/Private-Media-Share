var common,	logger,	mongoose, format,crypto;

module.exports = {
	
	/* Init function which initializes the required files 
	 */
	init: function(){
		
		common = require("./common.js");
		logger = common.logger;
		mongoose = require("mongoose");
		format = require("util").format;
		crypto = require("crypto");
	},
	
	/* This function checks if we can connect to the database or not
	 * Return(calls the callback): err,res,message
	 * 		- err: if an error has occurred or not
	 *		- res: a boolean value stating weather we have a connection or not
	 * 		- message: a message about what happened in the function, mostly for logging purposes 
	 */
	haveConnection: function(callback){
		
		var	log = logger("db.haveConnection");
		
		mongoose.connect(common.DB_URL_COMPLETE);
		
		var db = mongoose.connection;
		
		db.on("error", function(){
			
			try{
				db.close();
			}catch(e){
				console.log("Failed closing connection. there may be an issue..");
			}
			
			log.error("An error occurred while attempting to connection to the database.", 4);
			callback(true, false, "Could not connect to the database!");
		});
		
		db.once("open", function() {
			log.info("Successfully connected to the database.");
			callback(false, true, "A connection was established.");
		});
		
		db.close()
	},
	
	/* This function checks if the database has been set up already
	 * Return(calls the callback): err,res,message
	 * 		- err: if an error has occurred or not
	 * 		- res: a boolean value with the response. true = this is the first time running, false: the server has been run before
	 * 		- message: a message about what happened in the function, mostly for logging purposes 
	 */
	databaseAlreadySetUp: function(callback){
		
		var log = logger("db.databaseAlreadySetUp");
		
		log.info("Checking if this is the first run...");
		log.info("DB_URL_COMPLETE: "+common.DB_URL_COMPLETE);
		
		mongoose.connect(common.DB_URL_COMPLETE);
		
		var db = mongoose.connection;
		
		db.on("error", function(err){
			
			try{
				db.close();
			}catch(e){
				console.log("Failed closing connection. there may be an issue..");
			}
			
			log.error("An error occurred while attempting to connection to the database.", 4);
			callback(true, false, "Could not connect to the database!");
		});
		
		db.once("open", function() {
			
			log.info("Successfully connected to the database.");
			
			var setUp = false;
			
			try{
				log.info("Getting collection Names.");
				
				mongoose.connection.db.collectionNames( function (err, names) {
					
					if( !!!err && !!names ){
						
						var foundThis = false;
						var numberFound = 0;
						var collectionsLength = 0;
						
						for( var collection in common.COLLECTIONS ){
							
							foundThis = false
							
							log.info("Looking for match for '" + common.COLLECTIONS[collection].longName + "'.");
							
							for( var ith = 0; ith < names.length; ith++ ){
								
								if( names[ith].name === common.COLLECTIONS[collection].longName ){
									
									log.info("Found Collection '" + names[ith].name + "' in database.");
									foundThis = true;
								}
							}
							
							if( foundThis ){
								numberFound++;
							}
							
							collectionsLength++;
						}
						
						log.info( "Checking if all are found... numberFound: " + numberFound + ", collectionsLength: " + collectionsLength );
						
						if( numberFound === collectionsLength ){
							
							db.close();
							setUp = true;
							log.info("The database is already set up.");
							callback(false, setUp, "The database is already set up.");
							
						}else{
						
							db.close();
							setUp = false;
							log.info("The database has not been set up already.");
							callback(false, setUp, "The database has not been set up yet.");
						}

					}else{
						
						db.close();
						setUp = false;
						log.error("An error occurred while checking collection names. Error: "+ err );
						callback(true, setUp, "An error occurred while checking collection names. Error: "+err);
					}
				});
				
			}catch(e){
			
				db.close();
				setUp = false;
				log.error("An error occurred while attempting to look for the tables in the database. Error: "+e, 4);
				callback(true, setUp, "Could not look for the tables in the database. Error: "+e);
			}
		});
	},
	
	/* This function sets up the database documents and basic configuration information. 
	 * Return(calls the callback): err,res,message
	 * 		- err: if an error has occurred or not
	 * 		- message: a message about what happened in the function, mostly for logging purposes 
	 */
	initDatabase: function(callback){
		
		var	log = logger("db.initDatabase");
		
		var Schema = mongoose.Schema;
		mongoose.connect(common.DB_URL_COMPLETE);
		var db = mongoose.connection;
		
		var fileSystemSchema = new Schema( common.DATABASE_SCHEMA.FILE_SYSTEM_SCHEMA );	
		var accountsSchema = new Schema( common.DATABASE_SCHEMA.ACCOUNTS_SCHEMA );
		var globalsSchema = new Schema( common.DATABASE_SCHEMA.GLOBALS_SCHEMA );
		var logsSchema = new Schema( common.DATABASE_SCHEMA.LOGS_SCHEMA );
		
		db.on("error", function(err){
			
			try{
				db.close();
			}catch(e){
				console.log("Failed closing connection. there may be an issue..");
			}
			
			log.error("An error occurred while attempting to connection to the database.", 4);
			callback(true, false, "Could not connect to the database!");
		});
		
		db.once("open", function() {
		
			try{
				
				log.info("Creating filesystem collection...");
				var FileSystem = mongoose.model( common.COLLECTIONS.FILE_SYSTEM.name, fileSystemSchema );

				log.info("Creating accounts collection...");
				var accounts = mongoose.model( common.COLLECTIONS.ACCOUNTS.name, accountsSchema );
				
				log.info("Creating globals collection...");
				var globals = mongoose.model( common.COLLECTIONS.GLOBALS.name, globalsSchema );
				
				log.info("Creating logs collection...");
				var logs = mongoose.model( common.COLLECTIONS.LOGS.name, logsSchema );		
								
				db.close();
				
				log.info("Finished setting up database.");
				callback(false, "Database Set up Correctly.");
				
			}catch(e){
				log.error( "An Error occurred while setting up the database. Error: " + e, 4 );
				callback( true, "An error occurred while setting up the database, please try again. "+
						"If the problem persists, ensure the server can access the database, you can also manually delete all entries in the database." );
			}
		});
	},
	
	/* This function takes a message and logs it in the database 
	 * @param: log
	 *		- A string message which can be entered into the database
	 * Return: true
	 * 		- Does not wait on a callback
	 */
	storeLog: function(type, message, level){
		
		var	log = logger("db.storeLog");
		
		mongoose.connect(common.DB_URL_COMPLETE);
		var db = mongoose.connection;
		
		db.on("error", function(err){
			
			try{
				db.close();
			}catch(e){
				console.log("Failed closing connection. there may be an issue..");
			}
			
			log.error("An error occurred while attempting to connection to the database.", 4);
			callback(true, false, "Could not connect to the database!");
		});
		
		db.once("open", function() {
			
			var logsSchema = new Schema( common.DATABASE_SCHEMA.LOGS_SCHEMA );
			var LogModel = db.model(common.COLLECTIONS.LOGS.name, logsSchema);
			var logModel = new LogModel( { type: type,	message: message, level: level } );
			
			logModel.save(function (err) {
				
				if(err){
					console.error( "An error occurred while storing logs. Error: " + err );
				}
			});			
		});
	},
	
	/* This function takes the basic public information from the database and returns it to the user
	 * Return(calls the callback): err,res,message
	 * 		- err: if an error has occurred or not
	 * 		- res: an object containing all the basic information
	 * 		- message: a message about what happened in the function, mostly for logging purposes 
	 */
	getBasicServerData: function(callback){
	
		callback(false, {code: 200, name: "John Doe" }, "Found data in database and returning it to the user.");
	},
	
	/* This function takes a token and checks if the user is 
	 * @param: token
	 *		- The token is a 128 string of random characters which makes up the session identifier
	 * Return: err, res, message
	 * 		- err is whether or not an error has occurred
	 * 		- res is an object containing a field "code", either 200 or 404
	 * 		- message is a string containing the message of an error
	 */
	validateCredentials: function(token, callback){
		
		//TODO: Finished implementation
		callback(false, {code: 200}, "User is allowed.");
	},
	
	/* This function takes an email address and password and looks up the database and tries to sign in the user
	 * @param: email
	 *		- An email address for a given user
	 * @param: password
	 *		- A password in plain text which needs to be compared against the Hashed one in the database
	 * Return: err, res, message
	 * 		- err is whether or not an error has occurred
	 * 		- res is an object containing fields including code, name, random session ID etc
	 * 		- message is a string containing the message of an error
	 */
	signIn: function(email, password, callback){
		
		//TODO: Finished Implementation
		
		var hash = crypto.createHash("sha256").update(password).digest("base64");
		
		callback(false, {code: 200, name: "John Doe", session: "KJBlkbdslbc999y5r6tgvJHBJ"}, "User is signed in.");
	},
	
	/* This function signs out a user
	 * @param: token
	 *		- The token is a 128 string of random characters which makes up the session identifier
	 * Return: err, res, message
	 * 		- err is whether or not an error has occurred
	 * 		- res is an object containing a field "code"
	 * 		- message is a string containing the message of an error
	 */
	logOut: function(token, callback){
	
		//TODO: Finished Implementation
		callback(false, {code: 200}, "User is signed out.");
	},
	
	/* This function creates a user
	 * @param: email
	 *		- Is an email address which needs to be validated
	 * @param: fname
	 *		- Is a string of max length 32 characters
	 * @param: lname
	 *		- Is a string of max length 32 characters
	 * @param: key
	 *		- The token is a 256 string of random characters which makes up the session identifier
	 * @param: password
	 *		- Is a string of length 8 -> 32
	 * Return: err, res, message
	 * 		- err is whether or not an error has occurred
	 * 		- res is an object containing a field "code"
	 * 		- message is a string containing the message of an error
	 */
	createUser: function(email, fName, lName, key, password, level, callback){
		
		var passwordhash = crypto.createHash("sha256").update(password).digest("base64");
		
		var	log = logger("db.createUser");
		
		mongoose.connect(common.DB_URL_COMPLETE);
		var db = mongoose.connection;
		
		db.on("error", function(err){
			
			try{
				db.close();
			}catch(e){
				console.log("Failed closing connection. there may be an issue..");
			}
			
			log.error("An error occurred while attempting to connection to the database.", 4);
			callback(true, {code: 500}, "Could not connect to the database!");
		});
		
		db.once("open", function() {
			
			var accountsSchema = new Schema( common.DATABASE_SCHEMA.ACCOUNTS );
			var AccountsModel = db.model(common.COLLECTIONS.ACCOUNTS.name, accountsSchema);
			var accountsModel = new AccountsModel( { 
				firstName: fName,
				lastName: lName,
				emailAddress: email,
				userLevel: level,
				activity: { usage: 0, 
							activityLog:[
								{ type: "Account Management", description: "User created account", timeStamp: new Date() }
					]},
				},
				accountActive: false,
				signUpDate: new Date(),
				password: passwordhash, 
				salt: ""
			
			} );
			
			AccountsModel.save(function (err) {
				
				if(err){
					log.error( "An error occurred while creating user. Error: " + err, 1 );
					callback( false, {code: 500}, "An error occurred while creating user. Error: " + err );
				}else{
					log.info( "User " + firstName + " " + lastName + " (" + emailAddress + ") has created an account." );
					callback( false, {code: 200}, "User was created successfully." );
				}
			});			
		});
		
		
	}
};