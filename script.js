
let CLIENT_ID
let CLIENT_SECRET

let TOKEN_URI
let AUTH_URI
let REDIRECT_URI

let SCOPES
let ACCESS_TOKEN
let REFRESH_TOKEN

let urlParams
if (window.location.search){
    urlParams = new URLSearchParams(window.location.search);
}else{
    urlParams = new URLSearchParams('')
}

fetch('client_secret.json')
    .then(res => res.json())
    .then(res => {
        
        CLIENT_ID=res["web"]["client_id"]
        CLIENT_SECRET=res['web']['client_secret']

        TOKEN_URI=res["web"]["token_uri"]
        AUTH_URI=res["web"]["auth_uri"]
        REDIRECT_URI=res['web']['redirect_uris']

        SCOPES = 'https://www.googleapis.com/auth/drive';

        initialization()
    }).catch(error => console.log(error))

function authenticate(){
    open(`${AUTH_URI}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI[0]}&response_type=code&scope=${SCOPES}&access_type=offline&prompt=select_account`,"_self")
}

function initialization(){
    if (urlParams.get("token")){
        console.log(urlParams.get("token"))
        ACCESS_TOKEN=urlParams.get("token")
    }else if(urlParams.get("code")){
        if (localStorage.getItem('client_secret_DriveRenamer')){
            CLIENT_SECRET=localStorage.getItem('client_secret_DriveRenamer')
        }else{
            CLIENT_SECRET=prompt('Password')
            localStorage.setItem('client_secret_DriveRenamer',CLIENT_SECRET)
        }
        exchangeCodeForTokens(urlParams.get('code'),()=>{
            urlParams.delete('code',urlParams.get('code'))
            urlParams.set('token',ACCESS_TOKEN)
            open(location.href.replace(location.search,'')+'?'+urlParams.toString(),'_self')
        },false)
    }else{
        document.getElementById('btn_SignIn').style.display="block"
    }
    main()
}

function exchangeCodeForTokens(code,after,refresh) {
    // The parameters must be sent in a URL-encoded format
    let payload
    if (!refresh){
        payload = new URLSearchParams({
            'code': code,
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'redirect_uri': REDIRECT_URI[0],
            'grant_type': 'authorization_code'
        })
    }else{
        payload = new URLSearchParams({
            'refresh_token': code,
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'redirect_uri': REDIRECT_URI[0],
            'grant_type': 'refresh_token'
        })
    }
    
    console.log(payload)

    fetch(TOKEN_URI, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(), // Send the URL-encoded payload as the body
    })
    .then(async response => {
        if (!response.ok) {
            // If the response is not OK, we'll get the error details from the JSON body
            return response.json().then(errorData => {
                throw new Error(`Token exchange failed: ${response.status} - ${JSON.stringify(errorData)}`);
            });
        }
        // If the response is OK, parse the JSON data
        return response.json();
    })
    .then(tokenData => {
        // This is the data you need to store and use!
        console.log('Successfully received tokens:');
        console.log('Access Token:', tokenData.access_token);
        console.log('Refresh Token:', tokenData.refresh_token);
        console.log('Expires In:', tokenData.expires_in);
        console.log('Scope:', tokenData.scope);

        REFRESH_TOKEN=tokenData.refresh_token
        localStorage.setItem('refresh',JSON.stringify({'refresh_token':tokenData.refresh_token,'expires_in':tokenData.expires_in})) 
        ACCESS_TOKEN=tokenData.access_token

        after()
        // You would typically save the access and refresh tokens to a database here
        // and then send the access token to the client-side for API calls.
    })
    .catch(error => {
        // Handle any errors that occurred during the fetch or in the .then() blocks
        console.error('Error during token exchange:', error);
        localStorage.removeItem('client_secret')

        open(location.href,'_self')
        
    });
}

function getFilesInFolder(folderId,after){
    let params = new URLSearchParams({
        fields: "*",
        access_token: ACCESS_TOKEN,
        orderBy:"folder,name_natural",
        q:`"${folderId}" in parents and trashed = false`
    })

    fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`,{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(res => res.json())
        .then(json => {
            if (json.error && json.error.code===401) open(location.href.replace(location.search,""),'_self')
            console.log(json)
            after(json)
        })
}

async function getFilesInFolderAsync(folderId) {
    let allFiles = [];
    let pageToken = null;

    do {
        let queryParams = {
            fields: "nextPageToken, files(*)",
            access_token: ACCESS_TOKEN,
            orderBy: "folder,name_natural",
            q: `"${folderId}" in parents and trashed = false`
        };

        if (pageToken) {
            queryParams.pageToken = pageToken;
        }

        let params = new URLSearchParams(queryParams);

        let res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            })

        let json = await res.json()

        if (json.error && json.error.code === 401) {
            open(location.href.replace(location.search, ""), '_self')
        }

        if (json.error) {
            console.error("Google Drive API Error:", json.error)
            break
        }

        if (json.files && json.files.length > 0) {
            allFiles = allFiles.concat(json.files);
        }

        pageToken = json.nextPageToken;

    } while (pageToken);

    return allFiles;
}


let filesDB=[]
let filesCorres={}

function main(){

    getFilesInFolder(urlParams.get("id") || "root",(json)=>{
        filesDB=json
        let container=document.getElementById('div_files')
        let html=""

        for(let file of json.files){
            let isFolder
            if (file.mimeType==="application/vnd.google-apps.folder"){
                isFolder=file.id
            }else if (file.mimeType==="application/vnd.google-apps.shortcut" && file.shortcutDetails.targetMimeType==="application/vnd.google-apps.folder"){
                isFolder=file.shortcutDetails.targetId
            }else{
                isFolder=""
            }
            html+=`<card-file data-isFolder="${isFolder}" data-mimeType=${file.mimeType} data-id="${file.id}" data-quality="64" data-icon="${file.iconLink}" data-name="${file.name}" data-fileLink="${file.webViewLink}"></card-file>`
        }

        container.innerHTML=html+"<div style='width:100%;height:20px;'></div>"
    })
}

class file extends HTMLElement{
    constructor(){
        super()
    }
    connectedCallback(){
        this.isFolder=this.getAttribute("data-isFolder")
        this.name=this.getAttribute('data-name')
        this.icon=this.getAttribute('data-icon')
        this.quality=this.getAttribute('data-quality')
        this.id=this.getAttribute('data-id')
        this.fileLink=this.getAttribute("data-fileLink")
        this.mimeType=this.getAttribute('data-mimeType')

        filesCorres[this.id]=this

        this.style=`
        width:100%;
        `

        this.innerHTML=`
        <div style="width:100%;height:50px;display:flex;flex-direction:row;justify-content:left;align-items:center;border-bottom:1px solid #c7c7c7">
            <div style="width:100%;height:100%;display:flex;flex-direction:row;justify-content:left;align-items:center;gap:10px;">
                <img style="height:${this.isFolder ? 30 : 20}px;margin:0px ${this.isFolder ? 0 : 5}px;" src="${this.icon.replace("16",this.quality || "16")}">
                <h2 class="google-sans-font file-name" style="color:#1f1f1f;font-weight:500;font-size:1rem;">${this.name}</h2>
            </div>
            <div style="width:fit-content;height:100%;display:flex;flex-direction:row;justify-content:right;align-items:center;padding-right:20px">
                <button class="btn-rename" style="padding:8px;background-color:transparent;border:none;">
                    <svg height="20" viewBox="0 -960 960 960" width="20" focusable="false"><path d="m351-144 144-144h369v144H351Zm-183-72h51l375-375-51-51-375 375v51Zm-72 72v-153l498-498q11-11 23.84-16 12.83-5 27-5 14.16 0 27.16 5t24 16l51 51q11 11 16 24t5 26.54q0 14.45-5.02 27.54T747-642L249-144H96Zm600-549-51-51 51 51Zm-127.95 76.95L543-642l51 51-25.95-25.05Z"></path></svg>
                </button>   
                <button class="btn-copy" style="padding:8px;background-color:transparent;border:none;">
                    <svg width="20px" height="20px" viewBox="0 0 24 24" focusable="false" fill="currentColor"><path d="M19 19H8q-.825 0-1.412-.587Q6 17.825 6 17V3q0-.825.588-1.413Q7.175 1 8 1h7l6 6v10q0 .825-.587 1.413Q19.825 19 19 19ZM14 8V3H8v14h11V8ZM4 23q-.825 0-1.412-.587Q2 21.825 2 21V7h2v14h11v2ZM8 3v5-5 14V3Z"></path></svg>
                </button>  
            </div>

        </div>
        `

        this.addEventListener('click',()=>{
            if (this.isFolder) {
                urlParams.set("id",this.isFolder)
                open(location.href.replace(location.search,"")+"?"+urlParams.toString(),"_self")
            }
            else {
                open(this.fileLink,"_blank")
            }
        })

        document.getElementsByClassName('btn-rename')[Array.from(document.getElementsByTagName('card-file')).indexOf(this)].addEventListener('click',(e)=>{
            e.stopPropagation()
            showModalRename(this)
        })

        document.getElementsByClassName('btn-copy')[Array.from(document.getElementsByTagName('card-file')).indexOf(this)].addEventListener('click',(e)=>{
            e.stopPropagation()
            showModalCopy(this)
        })
    }
}

window.customElements.define("card-file",file)

let modals=document.getElementById('modals')

function showModal(ind){
    modals.style.display='flex'
    let ms=Array.from(document.getElementsByClassName('modal'))
    for (let m in ms){
        if (Number(m)===ind) ms[m].style.display='flex'
        else ms[m].style.display='none'
    }
}

function hideModal(){
    modals.style.display='none'
}


let currentFileRename
function showModalRename(file){
    currentFileRename=file
    document.getElementById('modal-rename-input').value=file.name
    showModal(0)
    document.getElementById('modal-rename-input').focus()
    document.getElementById('modal-rename-input').select()
}

let currentFileCopy
function showModalCopy(file){
    currentFileCopy=file
    document.getElementById('modal-copy-input').value=""
    showModal(1)
    document.getElementById('modal-copy-input').focus()
}

function UpdateProgressBarCopy(value){
    const prog=document.getElementById('modal-copyProgress-progress')
    prog.value=value
    prog.innerText=value

    if (value===100){
        document.getElementById('modals').style.pointerEvents=''
        document.getElementById('copyProgress-cancel-btn').classList.remove('btn-block')
    }
}

function showModalCopyProgress(){
    document.getElementById('modals').style.pointerEvents='none'
    document.getElementById('copyProgress-cancel-btn').classList.add('btn-block')
    UpdateProgressBarCopy(0)
    showModal(2)
}

function renameFile(file,newName){
    hideModal()

    let params = new URLSearchParams({
        fields: "",
        access_token: ACCESS_TOKEN,
    })
    
    fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?${params.toString()}`,{
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: newName
            })
        })
        .then(res => res.json())
        .then(json => {
            console.log(json)
            if (json.error){
                if (json.error.code===401){
                    open(location.href.replace(location.search,""),'_self')
                } else if (json.error.code===429 || json.error.code===403){
                    console.log("Error",json)
                }
            }else{
                file.name=newName
                file.getElementsByClassName('file-name')[0].innerHTML=newName
                console.log("Rename",newName)
            }
        })
}

function renameAll(){
    let intervalId
    let i=0
    let filesList=filesDB.files

    let r=()=>{
        i++

        let currentFile=filesList.splice(0,1)[0]
        console.log(currentFile)
        if (filesList.length===0) clearInterval(intervalId)
        let newName=currentFile.name.replaceAll('Copie de ',"")

        let params = new URLSearchParams({
            fields: "",
            access_token: ACCESS_TOKEN,
        })
        
        fetch(`https://www.googleapis.com/drive/v3/files/${currentFile.id}?${params.toString()}`,{
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newName
                })
            })
            .then(res => res.json())
            .then(json => {
                if (json.error){
                    if (json.error.code===401){
                        open(location.href.replace(location.search,""),'_self')
                    } else if (json.error.code===429 || json.error.code===403){
                        console.log("Error",json)
                    }
                }else{
                    filesCorres[currentFile.id].name=newName
                    filesCorres[currentFile.id].getElementsByClassName('file-name')[0].innerHTML=newName
                    console.log("Rename",newName)
                }
            })
    }
    intervalId=setInterval(r,100)
}

async function createFolder(nameFolder,parentId){

    let params = new URLSearchParams({
        fields: "id",
        access_token: ACCESS_TOKEN,
    })
    
    let res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`,{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: nameFolder,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parentId]
            })
        })

    let json = await res.json()
    
    if (json.error){
        if (json.error.code===401){
            open(location.href.replace(location.search,""),'_self')
        } else if (json.error.code===429 || json.error.code===403){
            console.log("Error",json)
        }
    }
    console.log("CreateFolder",json)
    return json
}

async function getFile(fileId){
    let params = new URLSearchParams({
        fields: "*",
        access_token: ACCESS_TOKEN,
    })
    
    let res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`,{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
    
    let json = await res.json()

    if (json.error){
        if (json.error.code===401){
            open(location.href.replace(location.search,""),'_self')
        } else if (json.error.code===429 || json.error.code===403){
            console.error("Error",json)
        }
    }

    return json
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function copyFolder(fileId,fileName,parentId,after){
    let filesInFolder=[]
    let folders=[[fileId,fileName,"application/vnd.google-apps.folder",parentId]]
    let unexploreFolders=[fileId]

    do{
        let currentFolder=unexploreFolders.splice(0,1)[0]
        let json = await getFilesInFolderAsync(currentFolder)
        console.log(json)

        for (let f of json){
            if (f.mimeType==="application/vnd.google-apps.folder"){
                folders.push([f.id,f.name,f.mimeType,currentFolder])
                unexploreFolders.push(f.id)
            }else if (f.mimeType==="application/vnd.google-apps.shortcut"){
                let resAccess=await getFile(f.shortcutDetails.targetId)
                let haveAccess=!resAccess.error 
                if (haveAccess && f.shortcutDetails.targetMimeType==="application/vnd.google-apps.folder"){
                    folders.push([f.shortcutDetails.targetId,f.name,f.targetMimeType,currentFolder])
                    unexploreFolders.push(f.shortcutDetails.targetId)
                }else if (haveAccess){
                    filesInFolder.push([f.shortcutDetails.targetId,f.name,f.targetMimeType,currentFolder])
                }else{
                    filesInFolder.push([f.id,f.name,f.mimeType,currentFolder])
                }
                
            }else filesInFolder.push([f.id,f.name,f.mimeType,currentFolder])
        }
    }while(unexploreFolders.length>0)

    console.log(folders,filesInFolder)
    UpdateProgressBarCopy(20)

    let len=folders.length+filesInFolder.length
    let n=0

    let corresFolderId={}
    corresFolderId[parentId]=parentId

    for (let folder of folders){
        let res=await createFolder(folder[1],corresFolderId[folder[3]])
        if (res.error){
            console.error("FOLDER DON'T CREATE")
        }
        console.log(res)
        corresFolderId[folder[0]]=res.id

        n++
        UpdateProgressBarCopy(20+80*(n/len))
    }

    let step=0
    let k=0

    for (let file of filesInFolder){
        let res=copySingleFile(file[0],file[1],corresFolderId[file[3]],(json)=>{
            if (json.error){
                console.error("FILE DON'T CREATE")
            }
            console.log(json)

            n++
            UpdateProgressBarCopy(20+80*(n/len))
        })
        k++
        if(Math.floor(k/10)>step){
            //delay to not over kill the server
            delay(1000)
            step++
        }
    }
}

async function copySingleFile(fileId,fileName,parentId,after=()=>{}){
    let params = new URLSearchParams({
        fields: "",
        access_token: ACCESS_TOKEN,
    })
    
    let res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy?${params.toString()}`,{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: fileName,
                parents: [parentId]
            })
        })
    
    let json = await res.json()

    if (json.error){
        if (json.error.code===401){
            open(location.href.replace(location.search,""),'_self')
        } else if (json.error.code===429 || json.error.code===403){
            console.log("Error",json)
        }
    }else{
        console.log("CopyFile",json)
    }

    after(json)
}

function copyFile(fileId,fileName,fileMimeType,parentUrl){
    showModalCopyProgress()
    let parentId
    if (parentUrl){
        const match = parentUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/)
        parentId = match ? match[1] : null
    }else parentId=urlParams.get("id")
    
    console.log(parentId)
    console.log(fileMimeType)

    if (fileMimeType==="application/vnd.google-apps.folder" || fileMimeType==="application/vnd.google-apps.shortcut"){
        copyFolder(fileId,fileName,parentId)

    }else{
        copySingleFile(fileId,fileName,parentId,()=>{UpdateProgressBarCopy(100)})
    }
}

