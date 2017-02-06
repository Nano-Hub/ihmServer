var express = require('express');
var app = express();

//Load modules
var sqlite3         =       require('sqlite3').verbose();
var db              =       new sqlite3.Database('./mydb.db');

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies


//-----------------------------------METHOD FOR ADMIN OR SELLER--------------------------------

//createMagasin
app.post('/createStore', function (req, res) {
  var nom_magasin = req.body.nom_magasin;

  //Check if magasin exist already
  db.all("SELECT * FROM Magasin WHERE nom='"+nom_magasin+"'",function(err,rows){
    //rows contain values while errors, well you can figure out.
    if(rows !== undefined && rows.length == 0)
    {
      //Genere code for magasin admin to give to magasin owner
      var code = generateCode();
      //insert the new store with a code
      db.run("INSERT into Magasin(nom,code,image) VALUES ('"+nom_magasin+"','"+code+"','null')");
      res.send('ok');
    }
    else //if the store already exists
    {
      res.send('not ok');
    }
  });
})

//insert new coupon in store
app.post('/addCouponFromStore', function (req, res) {
  var reduction = req.body.reduction;
  var delai = req.body.delai;
  var quantite = req.body.quantite;
  var id_utilisateur = req.body.id_utilisateur;

  //We check if the user own a store
  db.all("SELECT id_magasin FROM Utilisateur WHERE id_utilisateur='"+id_utilisateur+"'",function(err,rows){
    if(rows[0].id_magasin !== "null")
    {
      db.run("INSERT INTO Coupon (reduction,delai,quantite,id_magasin) VALUES ('"+reduction+"','"+delai+"','"+quantite+"', '"+id_magasin+"')");
      res.send("ok");
    }
  });

})

//delete a coupon in store
app.post('/deleteCouponFromStore', function (req, res) {
  var id_coupon = req.body.id_magasin;
  var id_utilisateur = req.body.id_utilisateur;

  //We check if the user is the owner of the store
  db.all("SELECT id_magasin FROM Utilisateur WHERE id_utilisateur='"+id_utilisateur+"'",function(err,rows){
    if(rows[0].id_magasin !== "null")
    {
      //We check if the coupon is for THIS store
      db.all("SELECT id_magasin FROM Coupon WHERE id_coupon='"+id_coupon+"'",function(err,rowsCoupon){
        if(rowsCoupon[0].id_magasin !== undefined && rowsCoupon[0].id_magasin == rows[0].id_magasin !== "null")
        {
          db.run("DELETE FROM Coupon WHERE id_coupon ='"+id_coupon);
          res.send("Coupon supprimé");
        }
        else {
          res.send("Le coupon n'appartient a votre magasin.");
        }
      });
    }
    else {
      res.send("Ce magasin n'est pas le votre!");
    }
  });
})



//-----------------------------------USER METHOD--------------------------
//select all coupons from store
app.get('/getAllCouponsFromStore', function (req, res) {

  db.all("SELECT nom, reduction, delai, quantite, image FROM Coupon JOIN Magasin ON Coupon.id_magasin = Magasin.id_magasin",function(err,rows){
    if(rows !== undefined)
    {
      res.send(rows);
    }
    else
    {
      throw err;
    }
  });
})

//select all  my coupon
app.get('/getMyCoupons', function (req, res) {
  var id_utilisateur = req.body.id_utilisateur;

  db.all("SELECT nom, reduction, delai FROM Coupon_utilisateur JOIN Magasin ON Coupon.id_magasin = Magasin.id_magasin WHERE id_utilisateur='"+id_utilisateur+"' AND type=0",function(err,rows){
    if(rows !== undefined)
    {
      res.send(rows);
    }
    else
    {
      throw err;
    }
  });
})

//select all coupons from user
app.get('/getAllCouponsFromUser', function (req, res) {
  //NEED SECURITY CHECK IF USER HAS COUPON
  db.all("SELECT Coupon_utilisateur.id_coupon, nom, reduction, delai FROM Coupon_utilisateur JOIN Coupon ON Coupon.id_coupon = Coupon_utilisateur.id_coupon JOIN Magasin ON Magasin.id_magasin = Coupon.id_magasin WHERE type=1",function(err,rows){
    if(rows !== undefined)
    {
      res.send(rows);
    }
    else
    {
      throw err;
    }
  });
})

//insert new coupon from a user
app.post('/addCouponFromUser', function (req, res) {
  var id_coupon = req.body.id_coupon;
  var id_utilisateur = req.body.id_utilisateur;

  db.run("UPDATE Coupon_utilisateur SET type=1 WHERE id_coupon='"+id_coupon+"' AND id_utilisateur='"+id_utilisateur+"'");
  res.send("ok");
})

//insert new coupon from a user
app.post('/takeCoupon', function (req, res) {
  var id_coupon = req.body.id_coupon;
  var id_utilisateur = req.body.id_utilisateur;


  db.all("SELECT quantite FROM Coupon WHERE id_coupon="+id_coupon+";",function(err,rows){
    //get the number of coupon
    var quantite = rows[0].quantite;
    if(quantite > 0) //if there is enought coupon
    {
      //we check if the user doesn't have already one coupon of this kind
      db.all("SELECT id_coupon FROM Coupon_utilisateur WHERE id_utilisateur="+id_utilisateur+" AND id_coupon="+id_coupon+";",function(err,rowsCoupon){
        if(rowsCoupon.length === 0)
        {
          quantite -= 1; //We get one
          db.run("UPDATE Coupon SET quantite='"+quantite+"' WHERE id_coupon='"+id_coupon+"'");
          //We add the coupon in our user database
          db.run("INSERT INTO Coupon_utilisateur(id_coupon, id_utilisateur, type)  VALUES('"+id_coupon+"','"+id_utilisateur+"', 0)"); //0 = my coupon
          res.send("ok");
        }
        else {
          res.send("Vous avez déjà un exemplaire de ce coupon.")
        }
      });
    }
    else {
      res.send("Il n'y pas de coupon disponible.");
    }
  });
})

//-------------------------------------ACCOUNT------------------------------
//Inscription
app.post('/register', function (req, res) {
  var identifiant = req.body.identifiant;
  var mot_de_passe = req.body.mot_de_passe;
  var code_magasin = req.body.code_magasin;

  if(code_magasin == "null")
  {
    db.run("INSERT into Utilisateur(identifiant,mot_de_passe,id_magasin) " +
    "VALUES ('"+identifiant+"','"+mot_de_passe+"','0')");
  }
  else
  {
    //Obtenir le magasin correspondant au code ou retourner null
  }

  res.send('Hello World!');
})

//Connexion
app.get('/login', function (req, res) {
  var identifiant = req.body.identifiant;
  var mot_de_passe = req.body.mot_de_passe;

  db.all("SELECT * FROM Utilisateur WHERE identifiant="+identifiant+" AND mot_de_passe="+mot_de_passe,function(err,rows){
    //rows contain values while errors, well you can figure out.
    if(rows.length !== 0)
    {
      //Si les informations de connexion sont bonnes
      if(rows[0].token == "null")
      {
        res.send(rows[0].token);
      }
      else {
        var token = generateToken();
        db.run("UPDATE Utilsateur SET token='"+token+"' WHERE id_utilisateur='"+rows[0].id_utilisateur+"'");
      }
    }
    else {
      res.send('identifiant ou mot de passe incorrect.');
    }
  });
})

//Delete account
app.delete('/delete', function (req, res) {
  var id_utilisateur = req.body.id_utilisateur;

  db.all("DELETE FROM Utilisateur WHERE id_utilisateur="+id_utilisateur,function(err,rows){
    res.send('ok');
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

function genrateToken()
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
