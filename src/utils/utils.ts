import fs from 'fs'

function log(...data: any[]) {
    try{

        const today = new Date().toJSON()
        const file_name = `${today.split("T")[0]}.log`

        const exist_dir = fs.existsSync(`./logs/cron`)
        if (!exist_dir) {
            fs.mkdirSync(`./logs/cron`)
        }

        const exist_file = fs.existsSync(`./logs/cron/${file_name}`)
        const message = `${today}: ${data.join(" ")}`
        if (!exist_file) {
            fs.writeFileSync(`./logs/cron/${file_name}`, "")
        }
        console.log(message)
        fs.appendFileSync(`./logs/cron/${file_name}`, `${message} \n`)
    }catch(e){
        console.log(e)
    }
}

export default log