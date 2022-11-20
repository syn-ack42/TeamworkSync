# TeamworkSync

Send time records to Teamwork via their public api.
Teamwork is nice but you may prefer using a different tool for loggin your work hours.
Typing your hours into Teamwork by hand is silly so this litte tool helps you to post them automatically - at leas as long as you can find a way to export your time records into a csv file and somehow include the Teamwork task id.

## Main Features

* Import csv files with time records (from - to and a Teamwork task ID)
* records are validated and sent to Teamwork via their public api
* optionally add notes and set the billable flag
* checks if the Teamwork task exists and if you can book on it
* Teamwork api token is protected by password
* Configure column names for csv import

Note: at this point only booking to Teamwork "tasks" is supported. Booking on projects level is not.

## Installation

Just download the binary for your platform and run it - it's an Electron app.

Note that your configuration will be stored on your platforms default user config storage location.
Windows: %APPDATA%\teamwork-sync\config.json
Linux: $XDG_CONFIG_HOME/TeamworkSync or ~/.config/teamwork-sync/config.json
macOS: ~/Library/Application Support/teamwork-sync/config.json
"/Users/franzrenger/Library/Application Support/teamwork-sync/config.json"

## Build from source

Download the source. In the directory src/teamwork-sync:

    npm run make
artifacts will be generated in src/teamwork-sync/out (as is the default)

## Usage

## Set-up

On first run you will need to create a password. The password will be used to encrypt your Teamwork api token when it is stored on your system. You can reset your password at any time but you will have to set your api token again.

Go to the "hamburger menu" on the right to open your configuration.
You will find a list of Teamwork fields mapped to colum names in your csv file. Adjust the config (or your csv file) so they match.
You will have to enter your Teamwork api token.
Check this article on where to find it: <https://apidocs.teamwork.com/docs/teamwork/d1b2de52c3cec-api-key-and-url>
The api token will be stored on your system so will not have to enter it every time. Don't worry it's encrypted with your password (use a decent password, obviously).
Once the config is saved you are good to go.

## Sending time records

To send records to Teamwork just follow the instructions in the UI.
Load the csv file by using the button or by dragging the file on your TeamworkSyn window.
The application will check the csv for erros like missing mandatory colums, broken values etc. The app will also pull the currently availale tasks from Teamwork and check them agains your records.
Any errors will be highlighted in the table of records and there will be a list of errors beneath the table. Errors are red and will stop you from sending data to Teamwork. Warnings are yellow and don't stop you from sending.
Once you are stisfied hit submit and watch the data go out.
I recommend checking Teamwork afterwards to verify that everything is OK and your records are correct.

## Using TeamworkSync with Grindstone

I use Grindstone (<https://www.epiforge.com/Grindstone/>) to log my working hours so these are the instructions to set it up for integration to Teamwork via TeamworkSync
