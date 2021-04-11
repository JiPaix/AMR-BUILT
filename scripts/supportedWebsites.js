const path = require('path')
const fs = require('fs')
const JSDOM = require('jsdom').JSDOM
const readmePath = path.resolve(__dirname, '../', 'README.md')
const iconPath = path.resolve(__dirname, '../', 'src', 'mirrors', 'icons')
dom = new JSDOM()
window = {}
document = dom.window.document
const mirrors = require('../src/mirrors/register_implementations').websitesDescription
let list = mirrors.filter(m=>!m.disabled && m.mirrorIcon)
list = list.map(m=> {
  return {name: m.mirrorName, icon:m.mirrorIcon} 
})

const tbody = document.createElement('tbody')
tbody.setAttribute('title', 'supportedws')
const table = document.createElement('table')
let currentTR = document.createElement('tr')

for(const [i, v] of list.entries()) {

  if(i % 20 === 0) {
    tbody.appendChild(currentTR)
    currentTR = document.createElement('tr')
  }
  const newTD = document.createElement('td')
  const newIMG = document.createElement('img')
  let icon = v.name.toLowerCase()
  const format = /data:image\/(.*);base64,/.exec(v.icon)[1]
  icon = icon.replace(/\W/g, '')
  icon = 'src/mirrors/icons/' + icon + '.' + format


  newIMG.src = icon
  newIMG.title = v.name
  newTD.appendChild(newIMG)
  currentTR.appendChild(newTD)

  if(i === list.length-1) {
    tbody.appendChild(currentTR)
  }
}
table.appendChild(tbody)

let readme = fs.readFileSync(readmePath).toString()


readme = readme.replace(/<tbody title=\"supportedws\">(.|\n|\r\n)*?<\/tbody>/g, table.innerHTML)


fs.writeFileSync(readmePath, readme)