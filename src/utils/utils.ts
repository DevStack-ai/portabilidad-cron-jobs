import fs from 'fs'

class Printer {
    private readonly path: string
    private readonly log_path: string = "./logs/cron"
    constructor(path: string) {

        fs.mkdirSync(`./logs/cron/${path}`)
        this.path = path
    }

    log = (...data: any[]) => {
        try{
    
            const today = new Date().toJSON()
            const file_name = `${today.split("T")[0]}.log`
    
            const exist_dir = fs.existsSync(`${this.log_path}/${this.path}`)
            if (!exist_dir) {
                fs.mkdirSync(`${this.log_path}/${this.path}`)
            }
    
            const exist_file = fs.existsSync(`${this.log_path}/${this.path}/${file_name}`)
            const message = `${today}: ${data.join(" ")}`
            if (!exist_file) {
                fs.writeFileSync(`${this.log_path}/${this.path}/${file_name}`, "")
            }
            console.log(message)
            fs.appendFileSync(`${this.log_path}/${this.path}/${file_name}`, `${message} \n`)
        }catch(e){
            console.log(e)
        }
    }

    error = (...data: any[]) => {
        try{
    
            const today = new Date().toJSON()
            const file_name = `error_${today.split("T")[0]}.log`
    
            const exist_dir = fs.existsSync(`${this.log_path}/${this.path}`)
            if (!exist_dir) {
                fs.mkdirSync(`${this.log_path}/${this.path}`)
            }
    
            const exist_file = fs.existsSync(`${this.log_path}/${this.path}/${file_name}`)
            const message = `${today}: ${data.join(" ")}`
            if (!exist_file) {
                fs.writeFileSync(`${this.log_path}/${this.path}/${file_name}`, "")
            }
            console.error(message)
            fs.appendFileSync(`${this.log_path}/${this.path}/${file_name}`, `${message} \n`)
        }catch(e){
            console.log(e)
        }
    } 

}



export default Printer