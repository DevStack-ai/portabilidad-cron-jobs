import moment from "moment"

export function generateXMLTemplate(data: any) {

    const [first_name, last_name] = data.name.normalize("NFKC").split("{|}")

    const template = `
    <?xml version="1.0" encoding="UTF-8"?>
      <transaction>
          <items>
              <item>
                 <metadata>
                    <carrier>CWP</carrier>
                    <transactiontype>Activation APC</transactiontype>
                    <name>${first_name || ""}</name>
                    <lastname>${last_name || ""}</lastname>
                    <idcard>${data.document}</idcard>
                    <email></email>
                    <datetime>${moment.utc().subtract(5, "hours").format("DD/MM/YYYY HH:mm:ss")}</datetime>
                </metadata>
              </item>
          </items>
      </transaction>
    `
    console.log(template)
    return template
}
