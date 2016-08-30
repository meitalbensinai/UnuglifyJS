import os
import sys
import re

TMP_DIR = sys.argv[1]

output_files = os.listdir(TMP_DIR)
correct_predictions = 0
total_predictions = 0

resultRegex = re.compile('^\d* \d*$')

for f in output_files:
	with open(TMP_DIR + "/" + f) as opened_file:
	  lines = [line.rstrip('\n') for line in opened_file]
	  for index,line in enumerate(lines):
		message = ""
		if (line.startswith("./")):
		  message = "in file: " + line
		elif (resultRegex.match(line)):
		  parts = line.split()
		  correct_predictions += int(parts[0])
		  total_predictions += int(parts[1])
		else:
		  message = line
		if (len(message) > 0):
		  print message
	final_sum = "%s / %s" % (correct_predictions, total_predictions)
	print final_sum

