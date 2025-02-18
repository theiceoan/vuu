package org.finos.vuu.viewport

import com.typesafe.scalalogging.LazyLogging
import org.finos.vuu.api.ViewPortDef
import org.finos.vuu.core.sort.{FilterAndSort, Sort, TwoStepCompoundFilter, UserDefinedFilterAndSort, VisualLinkedFilter}
import org.finos.vuu.core.table.{Column, KeyObserver, RowKeyUpdate}
import org.finos.vuu.net.{ClientSessionId, FilterSpec}
import org.finos.vuu.util.PublishQueue
import org.finos.toolbox.collection.array.ImmutableArray
import org.finos.toolbox.time.Clock
import org.finos.vuu.core.tree.TreeSessionTableImpl
import org.finos.vuu.viewport.tree.TreeNodeState

import java.util
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

class ViewPortUpdateType

case object RowUpdateType extends ViewPortUpdateType

case object SizeUpdateType extends ViewPortUpdateType

object DefaultRange extends ViewPortRange(0, 123)

case class ViewPortSelectedIndices(indices: Array[Int])

case class ViewPortSelection(rowKeyIndex: Map[String, Int], viewPort: ViewPort)

case class ViewPortVisualLink(childVp: ViewPort, parentVp: ViewPort, childColumn: Column, parentColumn: Column) {
  override def toString: String = "ViewPortVisualLink(" + childVp.id + "->" + parentVp.id + ", on " + childColumn.name + " = " + parentColumn.name + ")"
}

case class ViewPortRange(from: Int, to: Int) {
  def contains(i: Int): Boolean = {
    i >= from && i < to
  }

  def subtract(newRange: ViewPortRange): ViewPortRange = {
    var from = newRange.from
    var to = newRange.to

    if (newRange.from > this.from && newRange.from < this.to) {
      from = this.to
      to = newRange.to
    }

    if (newRange.from < this.from && newRange.to < this.to && newRange.to > this.from) {
      from = newRange.from
      to = this.from
    }

    ViewPortRange(from, to)
  }

}

case class ViewPortUpdate(vpRequestId: String, vp: ViewPort, table: RowSource, key: RowKeyUpdate, index: Int, vpUpdate: ViewPortUpdateType, size: Int, ts: Long)

trait ViewPort {

  def updateSpecificKeys(keys: ImmutableArray[String])

  def setRequestId(request: String): Unit

  def getRequestId: String

  def setEnabled(enabled: Boolean): Unit

  def isEnabled: Boolean

  def hasGroupBy: Boolean = getGroupBy != NoGroupBy

  def size: Int

  def id: String

  def filterAndSort: FilterAndSort

  def session: ClientSessionId

  def table: RowSource

  def setRange(range: ViewPortRange): Unit

  def setSelection(rowIndices: Array[Int]): Unit

  def setVisualLink(link: ViewPortVisualLink): Unit

  def removeVisualLink(): Unit

  def getRange: ViewPortRange

  def setKeys(keys: ImmutableArray[String]): Unit

  def setKeysAndNotify(key: String, keys: ImmutableArray[String]): Unit

  def getKeys: ImmutableArray[String]

  def getKeysInRange: ImmutableArray[String]

  def getVisualLink: Option[ViewPortVisualLink]

  def outboundQ: PublishQueue[ViewPortUpdate]

  def highPriorityQ: PublishQueue[ViewPortUpdate]

  def getColumns: ViewPortColumns

  def getSelection: Map[String, Int]

  def getRowKeyMappingSize_ForTest: Int

  def getGroupBy: GroupBy

  def getSort: Sort

  def combinedQueueLength: Int = highPriorityQ.length + outboundQ.length

  def filterSpec: FilterSpec

  def changeStructure(newStructuralFields: ViewPortStructuralFields): Unit

  def getTreeNodeStateStore: TreeNodeState

  def getStructure: ViewPortStructuralFields


  def getStructuralHashCode(): Int

  def getTableUpdateCount(): Long

  def ForTest_getSubcribedKeys: ConcurrentHashMap[String, String]

  def ForTest_getRowKeyToRowIndex: ConcurrentHashMap[String, Int]

  override def toString: String = {
    "VP(user:" + session.user + ",table:" + table.name + ",size: " + size + ",id:" + id + ") @" + session.sessionId
  }

  def delete(): Unit

  def keyBuildCount: Long

  def setLastHashAndUpdateCount(lastHash: Int, lastUpdateCount: Long)

  def getLastHash(): Int

  def getLastUpdateCount(): Long

}

//when we make a structural change to the viewport, it is via one of these fields
case class ViewPortStructuralFields(table: RowSource, columns: ViewPortColumns,
                                    viewPortDef: ViewPortDef,
                                    filtAndSort: FilterAndSort, filterSpec: FilterSpec,
                                    groupBy: GroupBy, theTreeNodeState: TreeNodeState)

case class ViewPortImpl(id: String,
                        //table: RowSource,
                        session: ClientSessionId,
                        outboundQ: PublishQueue[ViewPortUpdate],
                        highPriorityQ: PublishQueue[ViewPortUpdate],
                        structuralFields: AtomicReference[ViewPortStructuralFields],
                        range: AtomicReference[ViewPortRange]
                       )(implicit timeProvider: Clock) extends ViewPort with KeyObserver[RowKeyUpdate] with LazyLogging {

  private val viewPortLock = new Object

  @volatile private var enabled = true

  @volatile private var requestId: String = ""

  override def updateSpecificKeys(keys: ImmutableArray[String]): Unit = {
    keys.filter(rowKeyToIndex.containsKey(_)).foreach(key => highPriorityQ.push(ViewPortUpdate(this.requestId, this, this.table, RowKeyUpdate(key, this.table), rowKeyToIndex.get(key), RowUpdateType, this.keys.length, timeProvider.now())))
  }

  override def setRequestId(requestId: String): Unit = this.requestId = requestId

  override def getRequestId: String = this.requestId

  override def setEnabled(enabled: Boolean): Unit = {
    this.enabled = enabled
  }

  override def isEnabled: Boolean = this.enabled

  @volatile
  private var viewPortVisualLink: Option[ViewPortVisualLink] = None

  override def table: RowSource = structuralFields.get().table

  override def getStructure: ViewPortStructuralFields = structuralFields.get()

  override def getTreeNodeStateStore: TreeNodeState = structuralFields.get().theTreeNodeState

  private def onlyFilterOrSortChanged(newStructuralFields: ViewPortStructuralFields, current: ViewPortStructuralFields): Boolean = {
    newStructuralFields.table.asTable.name == current.table.asTable.name && newStructuralFields.groupBy == current.groupBy && newStructuralFields.columns == current.columns
  }

  def changeStructure(newStructuralFields: ViewPortStructuralFields): Unit = {

    val onlySortOrFilterChange = onlyFilterOrSortChanged(newStructuralFields, structuralFields.get())

    structuralFields.set(newStructuralFields)

    if (!onlySortOrFilterChange)
      sendUpdatesOnChange(range.get())
  }

  override def setSelection(rowIndices: Array[Int]): Unit = {
    viewPortLock.synchronized {
      val oldSelection = selection.map(kv => (kv._1, this.rowKeyToIndex.get(kv._1)))
      selection = rowIndices.filter(this.keys(_) != null).map(idx => (this.keys(idx), idx)).toMap
      for ((key, idx) <- selection ++ oldSelection) {
        publishHighPriorityUpdate(key, idx)
      }
    }
  }

  override def getSelection: Map[String, Int] = selection

  def setRange(newRange: ViewPortRange): Unit = {
    viewPortLock.synchronized {
      val oldRange = range.get()

      removeSubscriptionsForRange(oldRange)

      range.set(newRange)

      addSubscriptionsForRange(newRange)

      val diffRange = oldRange.subtract(newRange)
      sendUpdatesOnChange(diffRange)
    }
  }

  def removeSubscriptionsForRange(range: ViewPortRange): Unit = {
    (range.from until (range.to - 1)).foreach(i => {
      val key = if (keys.length > i) keys(i) else null
      if (key != null) {
        unsubscribeForKey(key)
      }
    })
  }

  def addSubscriptionsForRange(range: ViewPortRange): Unit = {
    (range.from until (range.to - 1)).foreach(i => {
      val key = if (keys.length > i) keys(i) else null
      if (key != null) {
        subscribeForKey(key, i)
      }
    })
  }

  //def setColumns(columns: List[Column])
  override def filterSpec: FilterSpec = structuralFields.get().filterSpec

  def sendUpdatesOnChange(currentRange: ViewPortRange): Unit = {

    val currentKeys = keys.toArray

    val from = currentRange.from
    val to = currentRange.to

    val inrangeKeys = currentKeys.slice(from, to)

    inrangeKeys.zip(from to to).foreach({ case (key, index) => publishHighPriorityUpdate(key, index) })
  }

  override def getColumns: ViewPortColumns = structuralFields.get().columns

  override def getRange: ViewPortRange = range.get()

  override def getGroupBy: GroupBy = structuralFields.get().groupBy

  override def getSort: Sort = structuralFields.get().filtAndSort.sort

  override def size: Int = keys.length

  override def getRowKeyMappingSize_ForTest: Int = rowKeyToIndex.size()

  override def filterAndSort: FilterAndSort = structuralFields.get().filtAndSort

  @volatile
  private var keys: ImmutableArray[String] = ImmutableArray.from[String](new Array[String](0))
  @volatile
  private var selection: Map[String, Int] = Map()

  private val subscribedKeys = new ConcurrentHashMap[String, String]()
  private val rowKeyToIndex = new ConcurrentHashMap[String, Int]()


  override def getStructuralHashCode(): Int = {
    37 * filterAndSort.hashCode() ^ getGroupBy.hashCode() ^ getColumns.hashCode()// ^ getTreeNodeStateHash()
  }

  private def getTreeNodeStateHash(): Int = {
    table match {
      case session: TreeSessionTableImpl =>
        session.getTree.nodeState.hashCode()
      case _ =>
        0
    }
  }

  override def getTableUpdateCount(): Long = {
    this.table.asTable.updateCounter
  }

  override def ForTest_getSubcribedKeys: ConcurrentHashMap[String, String] = subscribedKeys

  override def ForTest_getRowKeyToRowIndex: ConcurrentHashMap[String, Int] = rowKeyToIndex

  override def getKeys: ImmutableArray[String] = keys

  override def delete(): Unit = {
    this.setKeys(ImmutableArray.empty[String])
  }

  @volatile var keyBuildCounter: Long = 0

  override def keyBuildCount: Long = keyBuildCounter

  override def getKeysInRange: ImmutableArray[String] = {
    val currentKeys = keys.toArray

    val activeRange = range.get()

    val from = activeRange.from
    val to = activeRange.to

    val inrangeKeys = currentKeys.slice(from, to)

    ImmutableArray.from(inrangeKeys)
  }

  def setKeysPre(newKeys: ImmutableArray[String]): Unit = {
    //send ViewPort
    removeNoLongerSubscribedKeys(newKeys)
  }

  def setKeysInternal(newKeys: ImmutableArray[String]): Unit = {
    keys = newKeys
  }

  def setKeysPost(sendSizeUpdate: Boolean, newKeys: ImmutableArray[String]): Unit = {
    if (sendSizeUpdate) {
      highPriorityQ.push(ViewPortUpdate(this.requestId, this, null, RowKeyUpdate("SIZE", null), -1, SizeUpdateType, newKeys.length, timeProvider.now()))
    }
    subscribeToNewKeys(newKeys)
  }

  override def setKeysAndNotify(key: String, newKeys: ImmutableArray[String]): Unit = {
    val sendSizeUpdate = newKeys.length != keys.length
    setKeysPre(newKeys)
    setKeysInternal(newKeys)
    table.notifyListeners(key)
    setKeysPost(sendSizeUpdate, newKeys)
  }

  override def setKeys(newKeys: ImmutableArray[String]): Unit = {
    val sendSizeUpdate = newKeys.length != keys.length
    setKeysPre(newKeys)
    setKeysInternal(newKeys)
    setKeysPost(sendSizeUpdate, newKeys)
    keyBuildCounter += 1
  }

  override def onUpdate(update: RowKeyUpdate): Unit = {

    val index = rowKeyToIndex.get(update.key)

    logger.debug(s"VP got update for ${update.key} update, index = $index isDeleted = ${update.isDelete}, $update, pushing to queue")

    if (isInRange(index) && this.enabled) {
      outboundQ.push(ViewPortUpdate(this.requestId, this, update.source, RowKeyUpdate(update.key, update.source, update.isDelete), index, RowUpdateType, this.keys.length, timeProvider.now()))
    }

  }

  protected def isInRange(i: Int): Boolean = range.get().contains(i)

  protected def isObservedAlready(key: String): Boolean = subscribedKeys.get(key) != null

  protected def hasChangedIndex(oldIndex: Int, newIndex: Int): Boolean = oldIndex != newIndex

  protected def subscribeToNewKeys(newKeys: ImmutableArray[String]): Unit = {

    var index = 0

    var newlyAddedObs = 0

    var removedObs = 0

    while (index < newKeys.length) {

      val key = newKeys(index)

      val oldIndex = rowKeyToIndex.put(key, index)

      if (isInRange(index)) {

        if (!isObservedAlready(key)) {

          subscribeForKey(key, index)

          newlyAddedObs += 1

          publishHighPriorityUpdate(key, index)

        } else if (hasChangedIndex(oldIndex, index)) {
          publishHighPriorityUpdate(key, index)
        }

      } else {
        unsubscribeForKey(key)
        removedObs += 1
      }

      index += 1
    }

    if (newlyAddedObs > 0)
      logger.debug(s"[VP] ${this.id} Added $newlyAddedObs Removed $removedObs Obs ${this.table}, Range ${this.range}")
  }


  protected def removeNoLongerSubscribedKeys(newKeys: ImmutableArray[String]): Unit = {
    val newKeySet = new util.HashSet[String]()

    var i = 0

    //TODO: CJS this is not correct, we should only subscribe to keys within the VP range
    //this will check every key and remove it
    while (i < newKeys.length) {
      newKeySet.add(newKeys(i))
      i += 1
    }

    val iterator = subscribedKeys.entrySet().iterator()

    while (iterator.hasNext) {
      val oldEntry = iterator.next()
      val oldKey = oldEntry.getKey
      if (!newKeySet.contains(oldKey)) {
        unsubscribeForKey(oldKey)
      }
    }
  }

  def unsubscribeForKey(key: String): Unit = {
    subscribedKeys.remove(key)
    rowKeyToIndex.remove(key)
    removeObserver(key)
  }

  def subscribeForKey(key: String, index: Int): Unit = {
    subscribedKeys.put(key, "-")
    rowKeyToIndex.put(key, index)
    addObserver(key)
  }

  def publishHighPriorityUpdate(key: String, index: Int): Unit = {
    logger.debug(s"publishing update @[$index] = $key ")
    if (this.enabled) {
      highPriorityQ.push(ViewPortUpdate(this.requestId, this, table, RowKeyUpdate(key, table), index, RowUpdateType, this.keys.length, timeProvider.now()))
    }
  }

  private def addObserver(key: String) = {
    //logger.info("adding observer for key:" + key)
    table.addKeyObserver(key, this)
  }

  private def removeObserver(oldKey: String) = {
    if (table.isKeyObservedBy(oldKey, this)) {
      //logger.info("removing observer for key:" + oldKey)
      table.removeKeyObserver(oldKey, this)
    }
  }

  override def setVisualLink(link: ViewPortVisualLink): Unit = {
    viewPortLock.synchronized {
      val fields = this.structuralFields.get()
      val newFilterSort = fields.filtAndSort match {
        case udfs: UserDefinedFilterAndSort =>
          UserDefinedFilterAndSort(TwoStepCompoundFilter(VisualLinkedFilter(link), udfs.filter), udfs.sort)
        case x =>
          x
      }

      //set the filter and sort to include the selection filter
      this.structuralFields.set(fields.copy(filtAndSort = newFilterSort))
      this.viewPortVisualLink = Some(link)
    }
  }

  override def removeVisualLink(): Unit = {
    viewPortLock.synchronized {
      val fields = this.structuralFields.get()
      val filterAndSort = fields.filtAndSort match {
        case udfs: UserDefinedFilterAndSort =>
          udfs.filter match {
            //remove the visual linked filter from the filterandsort
            case TwoStepCompoundFilter(first, second) =>
              UserDefinedFilterAndSort(second, udfs.sort)
          }
      }
      //set the filter and sort to include the selection filter
      this.structuralFields.set(fields.copy(filtAndSort = filterAndSort))
      this.viewPortVisualLink = None
    }
  }

  override def getVisualLink: Option[ViewPortVisualLink] = this.viewPortVisualLink

  @volatile var lastCycleHash: Int = 0
  @volatile var lastUpdateCounter: Long = 0

  override def setLastHashAndUpdateCount(lastHash: Int, lastUpdateCount: Long): Unit = {
    lastCycleHash = lastHash
    lastUpdateCounter = lastUpdateCount
  }

  override def getLastHash(): Int = lastCycleHash

  override def getLastUpdateCount(): Long = lastUpdateCounter
}
