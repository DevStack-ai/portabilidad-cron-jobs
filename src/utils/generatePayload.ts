
//return a xml

type PayloadType = "PRE" | "POST"
interface contract {
    request_number: string;
    date: string;
    client_name: string;
    id: string;
    address: string;
    ctn: string;
    email: string;
    type: PayloadType;
}
export function generateXMLTemplate(data: contract) {

    const template = `
    <?xml version="1.0" encoding="UTF-8"?>
      <transaction>
          <items>
              <item>
                  <metadata>
                  <carrier>CWP</carrier>
                  <transactiontype>External Mobile Port ${data.type === "PRE" ? "Prepaid" : "Postpaid"} SPN</transactiontype>
                  <request_number>${data.request_number}</request_number>
                  <date>${data.date}</date>
                  <client_name>${data.client_name}</client_name>
                  <id>${data.id}</id>
                  <cedula>${data.id}</cedula>
                  <adress>${data.address}</adress>
                  <province>${data.address}</province>
                  <district>${data.address}</district>
                  <corregimiento>${data.address}</corregimiento>
                  <barriada>${data.address}</barriada>
                  <street>${data.address}</street>
                  <house>${data.address}</house>
                  <apto></apto>
                  <ctn>${data.ctn}</ctn>
                  <contact_client>${data.ctn}</contact_client>
                  <email>${data.email}</email>
                  <quantity_line>1</quantity_line>
                  <account_number>${data.ctn}</account_number>
                  <line_one>${data.ctn}</line_one>
                  <line_two></line_two>
                  <line_tre></line_tre>
                  <line_four></line_four>
                  <more_line_true></more_line_true>
                  <more_line_false>X</more_line_false>
                  <Current_telephone_service_dealer>Digicel Panama SA</Current_telephone_service_dealer>
                  <telephone_service_dealer>Cable and Wireless Panamá, S.A</telephone_service_dealer>
                  <telephone_contact_receiving_dealer>${data.type === "PRE" ? "123" : "161"}</telephone_contact_receiving_dealer>
                  <mail_dealer>DLPNCWP@cwpanama.com</mail_dealer>
                  <nip_pcs>${data.type === "POST" ? "" : "0000"}</nip_pcs>
                  <approved_true></approved_true>
                  <approved_false></approved_false>
                  <last_unpaid_invoice></last_unpaid_invoice>
                  <name_not_owner_line></name_not_owner_line>
                  <telephone_not_exist></telephone_not_exist>
                  <outside_local_charging_zone></outside_local_charging_zone>
                  <fixed_concessionaire_provide_prepayment></fixed_concessionaire_provide_prepayment>
                  <outstanding_balance_last_invoice></outstanding_balance_last_invoice>
                  <name_not_owner></name_not_owner>
                  <lost_or_stolen_device></lost_or_stolen_device>
                  <phone_not_exist></phone_not_exist>
                  <wrong_nip></wrong_nip>
                  <without_nip></without_nip>
                  <client_name_represent>${data.client_name}</client_name_represent>
                  <dealership>Telefonica Moviles Panama S.A</dealership>
                  <client_id_represent>${data.id}</client_id_represent>
                  <liberate_code_user></liberate_code_user>           
                  </metadata>
              </item>
          </items>
      </transaction>
    `
    

    return template
}