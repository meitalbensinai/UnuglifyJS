# calculatePrecisionVsFrequency.py <evaluation file> <histogram file> (md5|filename)

import sys
import hashlib

def loadHistogram(file):
    histogram = {}
    with open(file, "r") as opened_file:
        for line in opened_file:
            splitted_line = line.strip().split(" ")
            count = splitted_line[0]
            key = splitted_line[1]
            #res = line.strip().split(" ")
            #print res
            histogram[key] = int(count)
    return histogram

def calculateFilePrecision(evaluation_log):
    current_file = ""
    correct = 0
    total = 0
    file_precision = {}

    with open(evaluation_log, "r") as open_evaluation_log:
        for line in open_evaluation_log:
            stripped_line = line.rstrip('\n')
            if (stripped_line.startswith(".") or stripped_line.startswith("/home")):
                if ((current_file) != "" and (total > 0)):
                    file_precision[current_file] = float(correct) / total
                    correct = 0
                    total = 0
                current_file = stripped_line
            elif (stripped_line.endswith("(ok)")):
                correct += 1
                total += 1
            elif (stripped_line.endswith("(error)")):
                total += 1
    return file_precision

def processByFilename(histogram, file_precision):
    result = []
    for full_filename, precision in file_precision.iteritems():
        short_name = full_filename.split("/")[-1]
        if (short_name in histogram):
            appearances = histogram[short_name]
        else:
            appearances = 0
        result.append((full_filename, appearances, precision))
    return result

def processByMd5(histogram, file_precision):
    result = []
    for full_filename, precision in file_precision.iteritems():
        md5 = hashlib.md5(open(full_filename[3:], 'rb').read()).hexdigest()
        if (md5 in histogram):
            appearances = histogram[md5]
        else:
            appearances = 0
        result.append((full_filename[3:], appearances, precision))
    return result

if __name__ == '__main__':
    evaluation_log = sys.argv[1]
    histogram_file = sys.argv[2]

    histogram = loadHistogram(histogram_file)
    file_precision = calculateFilePrecision(evaluation_log)

    if (sys.argv[3] == "filename"):
        result = processByFilename(histogram, file_precision)
    elif (sys.argv[3] == "md5"):
        result = processByMd5(histogram, file_precision)
    else:
        print "No option was chosen (filename|md5)"
        exit(0)

    for (file, appearances, precision) in result:
        print  str(appearances) + "," + str(precision) + "," + str(file)