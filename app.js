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
  var token = req.body.token;
  var nom = req.body.nom;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else {
      var id_utilisateur = rows[0].id_utilisateur;
      //We check if the user own a store
      db.all("SELECT id_magasin FROM Utilisateur WHERE id_utilisateur='"+id_utilisateur+"'",function(err,rowsMaga){
        if(rowsMaga.length !== 0)
        {
          //Genere code for magasin admin to give to magasin owner
          var code = generateCode();
          //insert the new store with a code
          db.run("INSERT into Magasin(nom,code,image) VALUES ('"+nom+"','"+code+"','assets/img/default.png')");
          db.all("SELECT id_magasin FROM Magasin WHERE nom='"+nom+"'",function(err,rows){
            db.run("INSERT into Coupon(reduction,delai,quantite, id_magasin) VALUES (-1,-1,-1,'"+rowsMaga[0].id_magasin+"')");
          })
          res.status(200).send('ok');
        }
      });
    }
  });
})

//insert new coupon in store
app.post('/addCouponFromStore', function (req, res) {
  var reduction = req.body.reduction;
  var delai = req.body.delai;
  var quantite = req.body.quantite;
  var token = req.body.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else {
      var id_utilisateur = rows[0].id_utilisateur;
      //We check if the user own a store
      db.all("SELECT id_magasin FROM Utilisateur WHERE id_utilisateur='"+id_utilisateur+"'",function(err,rowsMaga){
        if(rowsMaga.length !== 0)
        {
          if(delai === "")
          delai = "-1";
          if(quantite === "")
          quantite = "-1";

          db.run("INSERT INTO Coupon (reduction,delai,quantite,id_magasin) VALUES ('"+reduction+"','"+delai+"','"+quantite+"', '"+rowsMaga[0].id_magasin+"')");
          res.status(200).send("ok");
        }
        else {
          res.status(400).send("Erreur");
        }
      });
    }
  });
})

//delete a coupon in store
app.delete('/deleteCouponFromStore', function (req, res) {
  var id_coupon = req.query.id_coupon;
  var token = req.query.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else {
      var id_utilisateur = rows[0].id_utilisateur;
      //We check if the user is the owner of the store
      db.all("SELECT id_magasin FROM Utilisateur WHERE id_utilisateur='"+id_utilisateur+"'",function(err,rowsMaga){
        console.log(rowsMaga);
        if(rowsMaga.length !== 0)
        {
          //We check if the coupon is for THIS store
          db.all("SELECT id_magasin FROM Coupon WHERE id_coupon='"+id_coupon+"'",function(err,rowsCoupon){
            if(rowsCoupon.length !==0 && rowsCoupon[0].id_magasin === rowsMaga[0].id_magasin)
            {
              db.run("DELETE FROM Coupon WHERE id_coupon ="+id_coupon);
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
  });
})

//select all coupons from our store
app.get('/getAllCouponsFromOurStore', function (req, res) {
  var token = req.query.token;

  db.all("SELECT id_magasin FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else {
      console.log(rows[0].id_magasin);
      var id_magasin = rows[0].id_magasin;
      db.all("SELECT nom, reduction, delai, quantite, image, id_coupon FROM Coupon JOIN Magasin ON Coupon.id_magasin = Magasin.id_magasin WHERE reduction != -1 AND Coupon.id_magasin="+id_magasin,function(err2,rows2){
        if(rows2 !== undefined && rows2.length !== 0)
        {
          res.status(200).send(rows2);
        }
        else
        {
          res.status(400).send("Vous n'avez pas de coupons");
        }
      });
    }
  });
})

//select all coupons from our store
app.get('/getAllStore', function (req, res) {
  db.all("SELECT nom,code,image FROM Magasin",function(err2,rows2){
    if(rows2 !== undefined && rows2.length !== 0)
    {
      res.status(200).send(rows2);
    }
    else
    {
      res.status(400).send("Erreur!");
    }
  });
})

//-----------------------------------USER METHOD--FIRST MARKET--------------------------
//select all coupons from store
app.get('/getAllCouponsFromStore', function (req, res) {

  db.all("SELECT nom, reduction, delai, quantite, image, id_coupon FROM Coupon JOIN Magasin ON Coupon.id_magasin = Magasin.id_magasin WHERE quantite > 0 OR quantite == -1 AND reduction != -1",function(err,rows){
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
      db.all("SELECT nom, reduction, delai, Coupon_utilisateur.id_coupon, image FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE Coupon_utilisateur.id_utilisateur='"+id_utilisateur+"' AND type=0",function(errMag,rowsMag){
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
  console.log(id_coupon);
  var token = req.body.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else {
      //The token is in the database
      var id_utilisateur = rows[0].id_utilisateur;

      db.all("SELECT quantite FROM Coupon WHERE id_coupon="+id_coupon+";",function(err,rows){
        //get the number of coupon
        var quantite = rows[0].quantite;
        if(quantite > 0 || quantite == "-1") //if there is enought coupon or unlimited (-1)
        {
          //we check if the user doesn't have already one coupon of this kind
          db.all("SELECT id_coupon FROM Coupon_utilisateur WHERE id_utilisateur="+id_utilisateur+" AND id_coupon="+id_coupon+";",function(err,rowsCoupon){
            if(rowsCoupon.length === 0)
            {

              if(quantite > 0)
              {
              quantite -= 1; //We get one
              db.run("UPDATE Coupon SET quantite='"+quantite+"' WHERE id_coupon='"+id_coupon+"'");
              }
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
  })
})


//-------------------------------------USER-METHODE - 2 nd MARKET-------------------------------------

//select all coupons from user
app.get('/getAllCouponsFromUser', function (req, res) {
  var token = req.query.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(400).send("Reconnectez-vous!");
    }
    else {
      //The token is in the database
      var id_utilisateur = rows[0].id_utilisateur;
      //type = 1 , coupon offered by user
      db.all("SELECT Coupon_utilisateur.id_coupon, nom, reduction, delai, image FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE type=1 AND id_utilisateur!="+id_utilisateur,function(err,rows){
        if(rows !== undefined)
        {
          res.status(200).send(rows);
        }
        else
        {
          res.status(400).send(err);
        }
      });
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
      res.status(400).send("Reconnectez-vous!");
    }
    else {
      //The token is in the database
      var id_utilisateur = rows[0].id_utilisateur;
      //type = 1 , coupon offered by user
      console.log(id_utilisateur);
      db.all("SELECT Coupon_utilisateur.id_coupon, nom, reduction, delai, image FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE type=1 AND id_utilisateur='"+id_utilisateur+"'",function(errOffer,rowsOffer){
        if(rowsOffer !== undefined)
        {
          console.log(rowsOffer);
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

app.get('/userType', function (req, res) {
  var token = req.query.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(400).send("Reconnectez-vous!");
    }
    else {
      //The token is in the database
      var id_utilisateur = rows[0].id_utilisateur;
      //type = 1 , coupon offered by user
      db.all("SELECT id_magasin FROM Utilisateur WHERE id_utilisateur="+id_utilisateur,function(errOffer,rowsOffer){

        if(rowsOffer.length !== 0)
        {

          if(id_utilisateur == 1)
          {
            var magaObj =
            {
              type: "admin"
            };
            res.status(200).send(magaObj);
          }
          else {
            if(rowsOffer[0].id_magasin == -1)
            {
              var magaObj =
              {
                type: "user"
              };
              res.status(200).send(magaObj);
            }
            else {
              var magaObj =
              {
                type: "gerant"
              };
              res.status(200).send(magaObj);
            }
          }

        }
        else
        {
          res.status(400).send("errOffer");
        }
      });
    }
  });
})

//select all coupons from one user
app.get('/getCouponsAskedByUser', function (req, res) {
  var token = req.query.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(400).send("Reconnectez-vous!");
    }
    else {
      //The token is in the database
      var id_utilisateur = rows[0].id_utilisateur;
      //type = 1 , coupon offered by user
      console.log(id_utilisateur);
      db.all("SELECT Coupon_utilisateur.id_coupon, nom, reduction, delai, image FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE type=2 AND id_utilisateur='"+id_utilisateur+"'",function(errOffer,rowsOffer){
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

//select all coupons from all user
app.get('/getAllCouponsAskedByUser', function (req, res) {

  db.all("SELECT Coupon_utilisateur.id_coupon, Magasin.nom FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE type=2",function(errOffer,rowsOffer){
    if(rowsOffer !== undefined)
    {
      res.status(200).send(rowsOffer);
    }
    else
    {
      res.status(400).send(errOffer);
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

//insert new coupon from a user (give a coupon)
app.post('/stopGivingCoupon', function (req, res) {
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
      db.run("UPDATE Coupon_utilisateur SET type=0 WHERE id_coupon='"+id_coupon+"' AND id_utilisateur='"+id_utilisateur+"'");
      res.status(201).send("ok");
    }
  });
})

//ask for a coupon
app.post('/askCoupon', function (req, res) {
  var id_magasin = req.body.id_magasin;
  var token = req.body.token;

  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else {
      var id_utilisateur = rows[0].id_utilisateur;
      // type = 2 coupon asked
      db.all("SELECT id_coupon FROM Coupon WHERE reduction=-1 AND id_magasin='"+id_magasin+"'",function(err,rowsCoupon){
        if(rowsCoupon === undefined || rowsCoupon.length === 0)
        {
          db.run("INSERT INTO Coupon_utilisateur(id_coupon, id_utilisateur, type)  VALUES('"+id_coupon+"','"+id_utilisateur+"', 2)"); //0 = my coupon
          res.status(201).send("ok");
        }
      });
    }
  });
})

//get all offer that can be asked
app.get('/getPossibleAskedOffer', function (req, res) {
  // type = 2 coupon asked && reduction - 1 = coupon pré-crée
  db.all("SELECT Magasin.id_magasin, Magasin.nom, Magasin.image FROM Magasin JOIN Coupon ON Coupon.id_magasin = Magasin.id_magasin WHERE Coupon.reduction=-1",function(err,rows){
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

  if(code_magasin == "")
  {
    db.run("INSERT into Utilisateur(identifiant,mot_de_passe,id_magasin, token) VALUES ('"+identifiant+"','"+mot_de_passe+"','-1', '"+token+"')");
    res.status(200).send("ok");
  }
  else
  {
    //Obtenir le magasin correspondant au code ou retourner null
    db.all("SELECT id_magasin FROM Magasin WHERE code='"+code_magasin+"'",function(err,rows){
      if(rows !== undefined && rows.length !== 0)
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


app.get('/getIdUser', function (req, res) {
  var token = req.query.token;

  db.all("SELECT identifiant FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(400).send("Reconnectez-vous!");
    }
    else
    {
      var tokenObj =
      {
        id: rows[0].identifiant
      };
      console.log(tokenObj);
      res.status(200).send(tokenObj);
    }
  });
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
      if(rows[0].token !== "null")
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
  console.log("mytoken ="+token);
  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else
    {
      var id_utilisateur = rows[0].id_utilisateur;
      db.run("UPDATE Utilisateur SET token='"+null+"' WHERE id_utilisateur='"+id_utilisateur+"'");
      res.status(201).send('ok');
    }
  });
})

//Delete account
app.delete('/delete', function (req, res) {
  var token = req.query.token;
  console.log("tok"+token);
  db.all("SELECT id_utilisateur FROM Utilisateur WHERE token='"+token+"'",function(err,rows){
    console.log(rows);
    if(rows === undefined || rows.length === 0)
    {
      //The token is not in the database
      res.status(401).send("Erreur: reconnectez-vous!");
    }
    else
    {
      //The token is in the database
      var id_utilisateur = rows[0].id_utilisateur;
      console.log("delete");
      db.all("DELETE FROM Utilisateur WHERE id_utilisateur="+id_utilisateur,function(errDelete,rowsDelete){
        res.status(200).send('ok');
      });
    }
  });
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
