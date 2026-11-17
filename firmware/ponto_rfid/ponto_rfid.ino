#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>

#define SS_PIN    5
#define RST_PIN   22
#define SERVO_PIN 13

MFRC522 rfid(SS_PIN, RST_PIN);
Servo catraca;

// Abre a catraca por 3 segundos e tranca de novo
void liberarAcesso() {
  Serial.println("ACESSO_LIBERADO");
  catraca.write(90);
  delay(3000);
  catraca.write(0);
}

// Lê o comando enviado pelo painel: "OPEN" ou "DENY"
void lerComandoSerial() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();

  if (cmd == "OPEN") {
    liberarAcesso();
  } else if (cmd == "DENY") {
    Serial.println("ACESSO_NEGADO");
  }
}

void setup() {
  Serial.begin(115200);

  SPI.begin(18, 19, 23, SS_PIN);  // SCK, MISO, MOSI, SS
  rfid.PCD_Init();

  catraca.attach(SERVO_PIN);
  catraca.write(0);  // catraca trancada

  Serial.println("ESP32_PRONTO");
}

void loop() {
  lerComandoSerial();

  // Espera um crachá novo no leitor
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  // Monta o UID em hexadecimal, ex.: "A1 B2 C3 D4"
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) uid += " ";
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  // O painel recebe o UID, confere no Firebase e responde OPEN ou DENY
  Serial.print("UID_LIDA:");
  Serial.println(uid);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
