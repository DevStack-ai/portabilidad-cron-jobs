import fs from 'fs'

function log(...data: any[]) {
    const today = new Date().toJSON()
    const file_name = `${today.split("T")[0]}.log`
    const exist_file = fs.existsSync(`./logs/cron/${file_name}`)
    const message = `${today}: ${data.join(" ")}`
    if (!exist_file) {
        fs.writeFileSync(`./logs/cron/${file_name}`, "")
    }
    console.log(message)
    fs.appendFileSync(`./logs/cron/${file_name}`, `${message} \n`)
}

export default log