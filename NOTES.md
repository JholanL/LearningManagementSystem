   # ==LMS Notes

   ## Status
   - Done: Step 1 (repo + .gitignore)
   - Done: Step 2 (backend scaffold)
   - Done: Step 3 (index.js)
   
   ## NOTES
   - npm init -y = is a package installation na (package.json) with "yes to all"
   - package-lock.json - exact version ng bawat package
   - npm warn deprecated.. should be discarded and don't run the npm audit fix --force, dahil baka eto pa makasira ng project. pero ang red na npm error ay need pansinin.
   - Bakit hiwalay ang client/ at server/; bakit .gitignore ang node_modules at .env
   -Isang beses lang binabasa ni Node ang file. Nasa memory na ang code kaya kailangan ng restart. Iyon ang gawa ni nodemon.
   -Route = eksaktong path + method. Kapag walang tugma, ang default ng Express ay 404 (Cannot GET /courses). Tamang behavior iyon, hindi bug.
   -404 vs "can't be reached": ang 404 ay may sumagot na server pero walang route. Ang "can't be reached" ay walang nakikinig sa port.
   -scripts = utos, devDependencies = ang package mismo. Dalawang beses lumalabas ang "nodemon" sa package.json pero magkaiba ang papel.
   -dependencies vs devDependencies: kapag tinanggal ang express, hindi tatakbo ang app. Kapag tinanggal ang nodemon, tatakbo pa rin. Kaya nasa dev ang nodemon.
   -start vs dev: start ang para sa production (node). dev ang para sa araw-araw (nodemon).
   -Ang commit ay dapat gumagana kapag na-clone ng iba. Ang package.json na tumutukoy sa index.js ay dapat may kasamang index.js.
   -"Clean" ang git status ay hindi patunay na kasama na ang file sa commit. Gamitin ang git ls-files para makita ang tinatrack.
   -Express 5.x at Mongoose 9.x ang gamit natin. Bago ito, kaya i-check ang version ng tutorial bago ka magduda sa sarili mo.


   ## Errors that have been solved
   - This site can't be reached → walang tumatakbong server. Tingnan ang terminal at ang folder.
   - Cannot GET /courses → walang route para sa path na iyon. Magdagdag ng app.get.
   - 'nodemon' is not recognized → hindi naka-install sa server/. Ayos: npm install --save-dev nodemon. Detect: npm ls nodemon.
   - Ang pag-edit ng file para mag-test ay nagdudulot ng uncommitted change. Mag-commit o mag-discard bago mag-move on.
   - Pagwawasto sa lumang note: ang npm init -y ay gumagawa lang ng package.json ("yes" sa lahat ng tanong). Hindi ito nag-i-install ng package. Ang npm install <pangalan> ang nag-i-install.
   - ...
   
   
   ## Mga desisyon
   
   - ...