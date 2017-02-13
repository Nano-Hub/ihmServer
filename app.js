var express = require('express');
var app = express();

//Load modules
var sqlite3         =       require('sqlite3').verbose();
var db              =       new sqlite3.Database('./mydb.db');

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  if ('OPTIONS' === req.method) {
    res.send(200);
  } else {
    next();
  }
};

app.use(allowCrossDomain);



//-----------------------------------METHOD FOR ADMIN OR SELLER--------------------------------

//createMagasin
app.post('/createStore', function (req, res) {
  var nom_magasin = req.body.nom_magasin;

  //Check if magasin exist already
  db.all("SELECT * FROM Magasin WHERE nom='"+nom_magasin+"'",function(err,rows){
    if(rows !== undefined && rows.length == 0)
    {
      //Genere code for magasin admin to give to magasin owner
      var code = generateCode();
      //insert the new store with a code
      db.run("INSERT into Magasin(nom,code,image) VALUES ('"+nom_magasin+"','"+code+"','null')");
      db.all("SELECT id_magasin FROM Magasin WHERE nom='"+nom_magasin+"'",function(err,rows){
        db.run("INSERT into Coupon(reduction,delai,quantite, id_magasin) VALUES (-1,-1,-1,'"+rows[0].id_magasin+"')");
      })
      res.status(200).send('ok');
    }
    else //if the store already exists
    {
      res.status(400).send('Store already exist');
    }
  });
})

//insert new coupon in store
app.post('/addCouponFromStore', function (req, res) {
  var reduction = req.body.reduction;
  var delai = req.body.delai;
  var quantite = req.body.quantite;
  var token = req.body.token;

  var id_utilisateur = checkToken(token);

  if(id_utilisateur != false)
  {
    //We check if the user own a store
    db.all("SELECT id_magasin FROM Utilisateur WHERE id_utilisateur='"+id_utilisateur+"'",function(err,rows){
      if(rows[0].id_magasin !== "null")
      {
        db.run("INSERT INTO Coupon (reduction,delai,quantite,id_magasin) VALUES ('"+reduction+"','"+delai+"','"+quantite+"', '"+id_magasin+"')");
        res.status(200).send("ok");
      }
    });
  }
  else {
    res.status(401).send("Erreur: reconnectez-vous!");
  }

})

//delete a coupon in store
app.delete('/deleteCouponFromStore', function (req, res) {
  var id_coupon = req.body.id_magasin;
  var token = req.body.token;

  var id_utilisateur = checkToken(token);

  if(id_utilisateur != false)
  {
    //We check if the user is the owner of the store
    db.all("SELECT id_magasin FROM Utilisateur WHERE id_utilisateur='"+id_utilisateur+"'",function(err,rows){
      if(rows[0].id_magasin !== "null")
      {
        //We check if the coupon is for THIS store
        db.all("SELECT id_magasin FROM Coupon WHERE id_coupon='"+id_coupon+"'",function(err,rowsCoupon){
          if(rowsCoupon[0].id_magasin !== undefined && rowsCoupon[0].id_magasin == rows[0].id_magasin !== "null")
          {
            db.run("DELETE FROM Coupon WHERE id_coupon ='"+id_coupon);
            res.status(200).send("Coupon supprimé");
          }
          else {
            res.status(400).send("Le coupon n'appartient a votre magasin.");
          }
        });
      }
      else {
        res.status(400).send("Ce magasin n'est pas le votre!");
      }
    });
  }
  else {
    res.status(401).send("Erreur: reconnectez-vous!");
  }
})

//-----------------------------------USER METHOD--FIRST MARKET--------------------------
//select all coupons from store
app.get('/getAllCouponsFromStore', function (req, res) {

  db.all("SELECT nom, reduction, delai, quantite, image FROM Coupon JOIN Magasin ON Coupon.id_magasin = Magasin.id_magasin",function(err,rows){
    if(rows !== undefined)
    {
      res.status(200).send(rows);
    }
    else
    {
      res.status(400).send(err);
    }
  });
})

//select all  my coupon
app.get('/getMyCoupons', function (req, res) {
  var token = req.query.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else {
      //The token is in the database
      //type = 0 mycoupon
      var id_utilisateur = rows[0].id_utilisateur;
      console.log(id_utilisateur);
      db.all("SELECT nom, reduction, delai, Coupon_utilisateur.id_coupon FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE Coupon_utilisateur.id_utilisateur='"+id_utilisateur+"' AND type=0",function(errMag,rowsMag){
        if(rowsMag !== undefined)
        {
          res.status(200).send(rowsMag);
        }
        else
        {
          res.status(400).send(errMag);
        }
      });
    }
  });
})

//insert new coupon from a user
app.post('/takeCoupon', function (req, res) {
  var id_coupon = req.body.id_coupon;
  var token = req.body.token;

  var id_utilisateur = checkToken(token);

  if(id_utilisateur != false)
  {
    db.all("SELECT quantite FROM Coupon WHERE id_coupon="+id_coupon+";",function(err,rows){
      //get the number of coupon
      var quantite = rows[0].quantite;
      if(quantite > 0 || quantite == "-1") //if there is enought coupon or unlimited (-1)
      {
        //we check if the user doesn't have already one coupon of this kind
        db.all("SELECT id_coupon FROM Coupon_utilisateur WHERE id_utilisateur="+id_utilisateur+" AND id_coupon="+id_coupon+";",function(err,rowsCoupon){
          if(rowsCoupon.length === 0)
          {
            quantite -= 1; //We get one
            db.run("UPDATE Coupon SET quantite='"+quantite+"' WHERE id_coupon='"+id_coupon+"'");
            //We add the coupon in our user database
            db.run("INSERT INTO Coupon_utilisateur(id_coupon, id_utilisateur, type)  VALUES('"+id_coupon+"','"+id_utilisateur+"', 0)"); //0 = my coupon
            res.status(201).send("ok");
          }
          else {
            res.status(400).send("Vous avez déjà un exemplaire de ce coupon.")
          }
        });
      }
      else {
        res.status(400).send("Il n'y pas de coupon disponible.");
      }
    });
  }
  else {
    res.status(401).send("Erreur: reconnectez-vous!");
  }
})


//-------------------------------------USER-METHODE - 2 nd MARKET-------------------------------------

//select all coupons from user
app.get('/getAllCouponsFromUser', function (req, res) {
  //TODO NEED SECURITY CHECK IF USER HAS COUPON
  //type = 1 , coupon offered by user
  db.all("SELECT Coupon_utilisateur.id_coupon, nom, reduction, delai FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE type=1",function(err,rows){
    if(rows !== undefined)
    {
      res.status(200).send(rows);
    }
    else
    {
      res.status(400).send(err);
    }
  });
})

//select all coupons from user
app.get('/getAllCouponsOfferedByUser', function (req, res) {
  var token = req.query.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(400).send(err);
    }
    else {
      //The token is in the database
      var id_utilisateur = rows[0].id_utilisateur;
      //type = 1 , coupon offered by user
      console.log(id_utilisateur);
      db.all("SELECT Coupon_utilisateur.id_coupon, nom, reduction, delai FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE type=1 AND id_utilisateur='"+id_utilisateur+"'",function(errOffer,rowsOffer){
        if(rowsOffer !== undefined)
        {
          res.status(200).send(rowsOffer);
        }
        else
        {
          res.status(400).send(errOffer);
        }
      });
    }
  });
})

//select all coupons from user
app.get('/getAllCouponsAskedByUser', function (req, res) {
  var token = req.query.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(400).send(err);
    }
    else {
      //The token is in the database
      var id_utilisateur = rows[0].id_utilisateur;
      //type = 1 , coupon offered by user
      console.log(id_utilisateur);
      db.all("SELECT Coupon_utilisateur.id_coupon, nom, reduction, delai FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE type=2 AND id_utilisateur='"+id_utilisateur+"'",function(errOffer,rowsOffer){
        if(rowsOffer !== undefined)
        {
          res.status(200).send(rowsOffer);
        }
        else
        {
          res.status(400).send(errOffer);
        }
      });
    }
  });
})

//insert new coupon from a user (give a coupon)
app.post('/addCouponFromUser', function (req, res) {
  var id_coupon = req.body.id_coupon;
  var token = req.body.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else {
      var id_utilisateur = rows[0].id_utilisateur;
      // type = 1 coupon offered by user
      db.run("UPDATE Coupon_utilisateur SET type=1 WHERE id_coupon='"+id_coupon+"' AND id_utilisateur='"+id_utilisateur+"'");
      res.status(201).send("ok");
    }
  });
})

//ask for a coupon
app.post('/askCoupon', function (req, res) {
  var nom_magasin = req.body.nom_magasin;
  var token = req.body.token;

  var id_utilisateur = checkToken(token);

  if(id_utilisateur != false)
  {
    // type = 2 coupon asked
    //faux cest un insrrt into
    db.run("UPDATE Coupon_utilisateur SET type=2 WHERE id_coupon='"+id_coupon+"' AND id_utilisateur='"+id_utilisateur+"'");
    res.status(201).send("ok");
    //TODO CORRIGER
  }
  else {
    res.status(401).send("Erreur: reconnectez-vous!");
  }
})

//get all offer that can be asked
app.get('/getPossibleAskedOffer', function (req, res) {
  // type = 2 coupon asked && reduction - 1 = coupon pré-crée
  db.all("SELECT id_magasin, nom FROM Magasin JOIN Coupon ON Coupon.id_magasin = Magasin.id_magasin WHERE reduction=-1",function(err,rows){
    res.status(200).send(rows);
  })
})

//-------------------------------------ACCOUNT------------------------------
//Inscription
app.post('/register', function (req, res) {
  var identifiant = req.body.identifiant;
  var mot_de_passe = req.body.mot_de_passe;
  var code_magasin = req.body.code_magasin;

  var token = generateToken();

  if(code_magasin == "null")
  {
    db.run("INSERT into Utilisateur(identifiant,mot_de_passe,id_magasin, token) VALUES ('"+identifiant+"','"+mot_de_passe+"','-1', '"+token+"')");
    res.status(200).send("ok");
  }
  else
  {
    //Obtenir le magasin correspondant au code ou retourner null
    db.all("SELECT id_magasin FROM Magasin WHERE code="+code_magasin,function(err,rows){
      if(rows.length !== 0)
      {
        db.run("INSERT into Utilisateur(identifiant,mot_de_passe,id_magasin,token) VALUES ('"+identifiant+"','"+mot_de_passe+"','"+rows[0].id_magasin+"', '"+token+"')");
        res.status(200).send("ok");
      }
      else {
        res.status(401).send("Erreur: Code faux!")
      }
    })
  }
})

//Connexion
app.post('/login', function (req, res) {
  var identifiant = req.body.identifiant;
  var mot_de_passe = req.body.mot_de_passe;

  console.log(identifiant);
  console.log(mot_de_passe);
  db.all("SELECT * FROM Utilisateur WHERE identifiant='"+identifiant+"' AND mot_de_passe='"+mot_de_passe+"'",function(err,rows){
    //rows contain values while errors, well you can figure out.
    if(rows.length !== 0)
    {
      //Si les informations de connexion sont bonnes
      console.log(rows[0].token);
      if(rows[0].token !== "NULL")
      {
        var tokenObj =
        {
          token: rows[0].token
        };
        res.status(200).send(tokenObj);
      }
      else {
        var token = generateToken();
        var tokenObj =
        {
          token: token
        };
        db.run("UPDATE Utilisateur SET token='"+token+"' WHERE id_utilisateur='"+rows[0].id_utilisateur+"'");
        res.status(200).send(tokenObj);
      }
    }
    else {
      res.status(400).send('identifiant ou mot de passe incorrect.');
    }
  });
})

//Disconnect
app.post('/disconnect', function (req, res) {
  var token = req.body.token;

  var id_utilisateur = checkToken(token);

  if(id_utilisateur != false)
  {
    db.run("UPDATE Utilisateur SET token='"+null+"' WHERE id_utilisateur='"+id_utilisateur+"'");
    res.status(201).send('ok');
  }
  else {
    res.status(401).send("Erreur!");
  }
})

//Delete account
app.delete('/delete', function (req, res) {
  var token = req.body.token;

  var id_utilisateur = checkToken(token);

  if(id_utilisateur != false)
  {
    db.all("DELETE FROM Utilisateur WHERE id_utilisateur="+id_utilisateur,function(err,rows){
      res.status(200).send('ok');
    });
  }
  else {
    res.status(401).send("Erreur: reconnectez-vous!");
  }
})

function generateCode()
{
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var codeGenerate = '';
  for(var i = 0; i< 8; i++)
  {
    var nbAlea = Math.random()*25;
    codeGenerate += characters.charAt(nbAlea);
  }
  return  codeGenerate;
}

function generateToken()
{
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
  var tokenGenerate = '';
  for(var i = 0; i< 20; i++)
  {
    var nbAlea = Math.random()*25;
    tokenGenerate += characters.charAt(nbAlea);
  }
  return  tokenGenerate;
}
//TODO IMPLEMENTE ALL FUNCTION USING TOKEN INSTEAD OF USER ID
function checkToken(token)
{
  //We check if the token is in the database
  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    console.log(rows);
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      console.log("1");
      return false;
    }
    else {
      //The token is in the database
      console.log("2");
      return rows[0].id_utilisateur;
    }
  });
}

app.listen(3000, function () {
  console.log('Your incredible app is listening on port 3000!');
})



//Perform SELECT Operation
//db.all("SELECT * from blah blah blah where this="+that,function(err,rows){
//rows contain values while errors, well you can figure out.
//});

//Perform INSERT operation.

//Perform DELETE operation
//db.run("DELETE * from table_name where condition");

//Perform UPDATE operation
//db.run("UPDATE table_name where condition");
