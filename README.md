# KOHSEC HTTP Flood

**For authorized penetration testing and stress testing only**

![KOHSEC Banner](assets/Banner.jpg)  
*(Ethical and controlled use — educational / authorized penetration testing tool)*

## ⚠️ Critical Legal & Ethical Warning — Read Before Use

**This tool is provided strictly for:**

- Security testing of systems **you legally own**
- Systems where you have **written, explicit, verifiable permission** from the owner
- Controlled lab environments, CTF challenges, or bug bounty programs (with clear scope)
- Educational and research purposes under applicable legal frameworks

**Any other use is strictly prohibited and may be illegal.**

Using this tool (or similar tools) against:

- Any website, server, API, network, or device **without explicit written permission**
- Production systems, third-party services, competitors, personal enemies, schools, governments, hospitals, etc.

**can constitute a serious criminal offense** in many jurisdictions.

### Examples of Illegal or Prohibited Use (non-exhaustive)

- DDoS or stress attacks on websites, game servers, Discord bots, Minecraft servers
- Testing without permission on friends', family members', companies', or schools' infrastructure
- "Testing" public websites "to see what happens"
- Revenge, activism, trolling, "showing off", pranks

**We (KOHSEC Team) are not responsible for any misuse.**

By using this software, you agree that:

- You are solely responsible for your actions
- You will comply with all applicable laws (including, but not limited to, CFAA (US), Computer Misuse Act (UK), EU Cybercrime Directive, Philippine Cybercrime Prevention Act, etc.)
- You will only use this tool on targets you own or have **provable written authorization** for

Violations **may be prosecuted** to the fullest extent of the law.  
Law enforcement agencies around the world actively investigate and prosecute DDoS and unauthorized stress-testing incidents — even small ones.

**We reserve the right to report suspected criminal misuse when evidence is provided.**

## Features

- HTTP/HTTPS GET & POST flood simulation
- Customizable threads (concurrent connections)
- Duration control
- Rotating User-Agents (Windows, Linux, iOS profiles)
- Optional custom payload for POST requests
- Real-time statistics (requests sent, errors)
- Modern dark UI

## Requirements

- Node.js 18+
- Express (included in dependencies)

## Installation

```bash
git clone https://github.com/yourusername/kohsec-http-flood.git
cd kohsec-http-flood
npm install
```

## Usage

```bash
npm start
# or
node server.js
```

## License

GNU General Public License
