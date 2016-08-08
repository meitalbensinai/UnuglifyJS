# movBadFiles.py <listFile> <newDir>
import sys
import os
import shutil

if __name__ == '__main__':
	listFileName = sys.argv[1]
	
	with open(listFileName, "r") as filesList:
		for line in filesList:
			filename = line.rstrip('\n')
			try:
				if (os.path.exists(filename)):
					os.remove(filename)
					print 'Deleted: ' + filename 
			except Exception, ex:
				print 'Failed to move ' + filename + ': ' + str(ex)
				continue