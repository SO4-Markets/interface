import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const contractIdsInput = process.env.CONTRACT_IDS || process.argv[2]
if (!contractIdsInput) {
  console.error("Error: CONTRACT_IDS environment variable or argument is required.")
  process.exit(1)
}

// Split by comma, space, or semicolon
const contractIds = contractIdsInput.split(/[\s,;]+/).filter(Boolean)

const outputBaseDir = path.resolve(__dirname, "../apps/web/src/lib/soroban/bindings")

// Ensure output base directory exists
fs.mkdirSync(outputBaseDir, { recursive: true })

for (const id of contractIds) {
  console.log(`Generating bindings for contract: ${id}...`)
  const outputDir = path.join(outputBaseDir, id)

  try {
    // Run stellar-cli to generate bindings
    const cmd = `npx @stellar/stellar-cli contract bindings typescript \
      --rpc-url https://soroban-testnet.stellar.org \
      --network-passphrase "Test SDF Network ; September 2015" \
      --contract-id ${id} \
      --output-dir ${outputDir} \
      --overwrite`

    execSync(cmd, { stdio: "inherit" })
    console.log(`Successfully generated bindings for ${id} in ${outputDir}`)
  } catch (error) {
    console.error(`Failed to generate bindings for contract ${id}:`, error)
    process.exit(1)
  }
}
